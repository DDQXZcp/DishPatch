package com.dishpatch.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketMessage;
import org.springframework.web.socket.WebSocketSession;

import java.net.ConnectException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
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

        RosBridgeService retrying = new RosBridgeService() {
            @Override
            protected CompletableFuture<WebSocketSession> openSession() {
                if (attempts.incrementAndGet() < 3) {
                    return CompletableFuture.failedFuture(new ConnectException("refused"));
                }
                return CompletableFuture.completedFuture(session);
            }
        };
        retrying.setRetryDelayMs(5);

        retrying.connect();

        long deadline = System.currentTimeMillis() + 2000;
        while (attempts.get() < 3 && System.currentTimeMillis() < deadline) {
            Thread.sleep(5);
        }

        assertEquals(3, attempts.get(),
                "should have retried past the refused connections");

        // And stops once connected, rather than reconnecting over a live session.
        Thread.sleep(50);
        assertEquals(3, attempts.get(), "kept dialing after the handshake succeeded");
    }

    /** One close does not start a second retry loop on top of the running one. */
    @Test
    void doesNotStackRetryLoops() throws Exception {
        AtomicInteger attempts = new AtomicInteger();

        RosBridgeService retrying = new RosBridgeService() {
            @Override
            protected CompletableFuture<WebSocketSession> openSession() {
                attempts.incrementAndGet();
                return CompletableFuture.failedFuture(new ConnectException("refused"));
            }
        };
        retrying.setRetryDelayMs(1000);

        retrying.connect();
        retrying.afterConnectionClosed(session, CloseStatus.SESSION_NOT_RELIABLE);
        retrying.connect();

        Thread.sleep(100);

        assertEquals(1, attempts.get(),
                "each connect() started its own loop; they will race for the session");
    }
}
