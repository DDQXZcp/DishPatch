package com.dishpatch.service;

import jakarta.websocket.WebSocketContainer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketMessage;
import org.springframework.web.socket.WebSocketSession;

import java.net.ConnectException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Robot discovery in {@link RosBridgeService}: the fleet is whatever rosbridge
 * says is on the ROS graph, not a configured number.
 *
 * Driven through the WebSocket handler methods with a fake session, so no
 * rosbridge and no Spring context are involved.
 */
class RosBridgeServiceTest {

    private RosBridgeService service;
    private WebSocketSession session;

    /** Everything the service has sent to rosbridge, in order. */
    private List<String> sent;

    @BeforeEach
    void setUp() throws Exception {
        service = new RosBridgeService();
        sent = new ArrayList<>();

        session = mock(WebSocketSession.class);
        when(session.isOpen()).thenReturn(true);

        doAnswer(invocation -> {
            WebSocketMessage<?> message = invocation.getArgument(0);
            sent.add(String.valueOf(message.getPayload()));
            return null;
        }).when(session).sendMessage(any());
    }

    /** A rosapi_msgs/Topics response carrying the given topic/type pairs. */
    private static String topicsResponse(String... topicsAndTypes) {
        StringBuilder topics = new StringBuilder();
        StringBuilder types = new StringBuilder();

        for (int i = 0; i < topicsAndTypes.length; i += 2) {
            if (i > 0) {
                topics.append(",");
                types.append(",");
            }
            topics.append("\"").append(topicsAndTypes[i]).append("\"");
            types.append("\"").append(topicsAndTypes[i + 1]).append("\"");
        }

        return "{\"op\":\"service_response\",\"id\":\"dishpatch-robot-discovery\","
                + "\"service\":\"/rosapi/topics\",\"result\":true,"
                + "\"values\":{\"topics\":[" + topics + "],\"types\":[" + types + "]}}";
    }

    private void receive(String payload) {
        service.handleTextMessage(session, new TextMessage(payload));
    }

    private boolean sentContaining(String... fragments) {
        return sent.stream().anyMatch(message -> {
            for (String fragment : fragments) {
                if (!message.contains(fragment)) {
                    return false;
                }
            }
            return true;
        });
    }

    /**
     * #68: the client's container defaulted to an 8 KB text buffer, and Nav2's
     * retained goal-status array grew past it under load. Every connection then
     * died on the first frame it received and reconnected straight into the same
     * failure, which blanked the frontend and stranded a robot in RETURNING.
     * <p>
     * The fix is one line in {@code createClient}, it has no other test, and
     * removing it would look harmless in review.
     */
    @Test
    void raisesTheReceiveBufferWellPastNav2sRetainedStatusArray() {
        // Read off the client the service will actually dial with, not a container
        // built alongside it. The wiring is half the fix: ContainerProvider hands out
        // a fresh 8 KB container per call, so a createClient() that dropped the
        // argument would be straight back in #68 while a freshly built container
        // still measured 1 MB. StandardWebSocketClient exposes no getter, hence the
        // reflection — a Spring field rename fails this loudly rather than quietly
        // passing.
        Object client = ReflectionTestUtils.getField(new RosBridgeService(), "client");
        WebSocketContainer container = (WebSocketContainer)
                ReflectionTestUtils.getField(client, "webSocketContainer");

        // Compared against a literal rather than MAX_TEXT_MESSAGE_BYTES: reading the
        // constant back would pass no matter what it was changed to.
        assertTrue(container.getDefaultMaxTextMessageBufferSize() >= 1024 * 1024,
                "text buffer is back near the 8 KB default that caused #68");
    }

    @Test
    void asksRosapiForTheTopicListOnConnect() throws Exception {
        service.afterConnectionEstablished(session);

        assertTrue(sentContaining("\"op\":\"call_service\"", "\"service\":\"/rosapi/topics\""),
                "should have called /rosapi/topics, sent: " + sent);
    }

    @Test
    void subscribesToEveryRobotStatusTopicOnTheGraph() throws Exception {
        service.afterConnectionEstablished(session);
        sent.clear();

        receive(topicsResponse(
                "/rosout", "rcl_interfaces/msg/Log",
                "/robot1/status", "shared_msgs/msg/RobotStatus",
                "/robot1/odom", "nav_msgs/msg/Odometry",
                "/robot2/status", "shared_msgs/msg/RobotStatus"
        ));

        assertEquals(List.of(1, 2), service.followedRobotIds());

        for (int id : new int[] { 1, 2 }) {
            assertTrue(sentContaining("\"op\":\"subscribe\"",
                    "\"topic\":\"/robot" + id + "/status\"",
                    "\"type\":\"shared_msgs/msg/RobotStatus\""),
                    "no status subscription for robot " + id + ", sent: " + sent);

            assertTrue(sentContaining("\"op\":\"subscribe\"",
                    "\"topic\":\"/robot" + id + "/navigate_to_pose/_action/status\""),
                    "no nav status subscription for robot " + id + ", sent: " + sent);

            assertTrue(sentContaining("\"op\":\"advertise\"",
                    "\"topic\":\"/robot" + id + "/goal_pose\""),
                    "goal topic not advertised for robot " + id + ", sent: " + sent);
        }

        // Only /robot{id}/status makes a robot; other topics are not fleet members.
        assertFalse(sentContaining("/robot1/odom"), "subscribed to a non-status topic");
        assertFalse(sentContaining("/rosout"), "subscribed to a non-status topic");
    }

    @Test
    void picksUpRobotsThatAppearLaterWithoutResubscribingTheRest() throws Exception {
        service.afterConnectionEstablished(session);
        receive(topicsResponse("/robot1/status", "shared_msgs/msg/RobotStatus"));
        sent.clear();

        // Second pass: robot1 is already followed, robot3 just booted.
        receive(topicsResponse(
                "/robot1/status", "shared_msgs/msg/RobotStatus",
                "/robot3/status", "shared_msgs/msg/RobotStatus"
        ));

        assertEquals(List.of(1, 3), service.followedRobotIds());
        assertFalse(sentContaining("/robot1/"), "resubscribed a known robot, sent: " + sent);
        assertTrue(sentContaining("\"op\":\"subscribe\"", "\"topic\":\"/robot3/status\""),
                "did not subscribe the new robot, sent: " + sent);
    }

    @Test
    void ignoresAFailedDiscoveryCall() throws Exception {
        service.afterConnectionEstablished(session);
        sent.clear();

        // How rosbridge answers when rosapi is not running: an error string
        // where the response object would be.
        receive("{\"op\":\"service_response\",\"id\":\"dishpatch-robot-discovery\","
                + "\"service\":\"/rosapi/topics\",\"result\":false,"
                + "\"values\":\"service /rosapi/topics does not exist\"}");

        assertEquals(List.of(), service.followedRobotIds());
        assertEquals(List.of(), sent);
    }

    @Test
    void forgetsTheFleetWhenTheSessionIsReplaced() throws Exception {
        service.afterConnectionEstablished(session);
        receive(topicsResponse("/robot1/status", "shared_msgs/msg/RobotStatus"));

        // A reconnect starts a fresh rosbridge session, which holds none of the
        // old subscriptions — the service must resubscribe rather than assume.
        service.afterConnectionEstablished(session);
        assertEquals(List.of(), service.followedRobotIds());

        sent.clear();
        receive(topicsResponse("/robot1/status", "shared_msgs/msg/RobotStatus"));

        assertEquals(List.of(1), service.followedRobotIds());
        assertTrue(sentContaining("\"op\":\"subscribe\"", "\"topic\":\"/robot1/status\""),
                "did not resubscribe after reconnect, sent: " + sent);
    }

    /**
     * The retry loop has to keep trying after a refused connection.
     *
     * It used to stop after one attempt: {@code execute} completes its future
     * exceptionally rather than throwing, and the loop never looked at it. A backend
     * that started while rosbridge was down — every fleet redeploy — stayed down until
     * the container was restarted.
     */
    @Test
    void keepsRetryingUntilTheHandshakeSucceeds() throws Exception {
        AtomicInteger attempts = new AtomicInteger();
        CountDownLatch thirdAttempt = new CountDownLatch(3);
        CountDownLatch fourthAttempt = new CountDownLatch(4);

        RosBridgeService retrying = new RosBridgeService() {
            @Override
            protected CompletableFuture<WebSocketSession> openSession() {
                int attempt = attempts.incrementAndGet();
                thirdAttempt.countDown();
                fourthAttempt.countDown();

                if (attempt < 3) {
                    return CompletableFuture.failedFuture(new ConnectException("refused"));
                }
                return CompletableFuture.completedFuture(session);
            }
        };
        retrying.setRetryDelayMs(5);

        retrying.connect();

        // Waits for the third dial rather than for a fixed stretch of time, so a
        // loaded CI runner makes this slower rather than red.
        assertTrue(thirdAttempt.await(5, TimeUnit.SECONDS),
                "should have retried past the refused connections; saw "
                        + attempts.get() + " attempt(s)");

        // And stops once connected, rather than reconnecting over a live session.
        // A fourth dial would be due 5ms after the third, so 200ms of silence is
        // a 40x margin on the answer being "it stopped".
        assertFalse(fourthAttempt.await(200, TimeUnit.MILLISECONDS),
                "kept dialing after the handshake succeeded");
    }

    /** One close does not start a second retry loop on top of the running one. */
    @Test
    void doesNotStackRetryLoops() throws Exception {
        AtomicInteger attempts = new AtomicInteger();
        CountDownLatch firstAttempt = new CountDownLatch(1);
        CountDownLatch secondAttempt = new CountDownLatch(2);

        RosBridgeService retrying = new RosBridgeService() {
            @Override
            protected CompletableFuture<WebSocketSession> openSession() {
                attempts.incrementAndGet();
                firstAttempt.countDown();
                secondAttempt.countDown();
                return CompletableFuture.failedFuture(new ConnectException("refused"));
            }
        };
        retrying.setRetryDelayMs(5_000);

        retrying.connect();

        assertTrue(firstAttempt.await(5, TimeUnit.SECONDS),
                "the first loop never dialled at all");

        retrying.afterConnectionClosed(session, CloseStatus.SESSION_NOT_RELIABLE);
        retrying.connect();

        // A loop dials before it sleeps, so a second one would land within
        // microseconds — 500ms is an enormous margin for detecting it. The window
        // only has to stay under the 5s retry delay to avoid mistaking the first
        // loop's own second dial for a stacked one.
        assertFalse(secondAttempt.await(500, TimeUnit.MILLISECONDS),
                "a second retry loop started dialling; the two will race for the session");
        assertEquals(1, attempts.get());
    }
}
