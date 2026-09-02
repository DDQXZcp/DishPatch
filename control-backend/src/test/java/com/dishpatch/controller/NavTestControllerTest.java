package com.dishpatch.controller;

import com.dishpatch.map.DropPointMap;
import com.dishpatch.map.DropPointService;
import com.dishpatch.service.RosBridgeService;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The bench-testing nav endpoint, with the flag on.
 *
 * <p>This endpoint publishes goals straight to physical robots with no
 * authentication in front of it. Its four outcomes are worth pinning precisely
 * because the thing on the other end is a machine that moves: the difference
 * between a 200 and a 502 is the difference between "a robot is now driving" and
 * "nothing happened", and a caller that cannot tell those apart will send it twice.
 *
 * <p>See {@link NavTestControllerDisabledTest} for the more important half.
 */
@WebMvcTest(NavTestController.class)
@TestPropertySource(properties = "nav.test-endpoint.enabled=true")
class NavTestControllerTest {

    private static final DropPointMap.DropPoint T4 =
            new DropPointMap.DropPoint("T4", 23.226, 9.241, 0.0);

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private DropPointService dropPointService;

    @MockBean
    private RosBridgeService rosBridgeService;

    @BeforeEach
    void setUp() {
        when(rosBridgeService.isConnected()).thenReturn(true);

        // Everything is unknown except T4, so the 404 path needs no per-test setup.
        when(dropPointService.find(anyString())).thenReturn(Optional.empty());
        when(dropPointService.find("T4")).thenReturn(Optional.of(T4));
    }

    private static String goal(String destination) {
        return "{\"robotId\":1,\"destination\":\"" + destination + "\"}";
    }

    // ── the read-only endpoints ──────────────────────────────────────────────

    @Test
    void reportsTheFleetLinkAndHowManyDestinationsLoaded() throws Exception {
        when(rosBridgeService.followedRobotIds()).thenReturn(List.of(1, 2));
        when(dropPointService.all()).thenReturn(List.of(T4));

        mockMvc.perform(get("/api/nav/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rosbridgeConnected").value(true))
                .andExpect(jsonPath("$.robots[0]").value(1))
                .andExpect(jsonPath("$.robots[1]").value(2))
                .andExpect(jsonPath("$.destinationsLoaded").value(1));
    }

    @Test
    void listsDestinationsWithTheirPoses() throws Exception {
        when(dropPointService.frameId()).thenReturn("map");
        when(dropPointService.all()).thenReturn(List.of(T4));

        mockMvc.perform(get("/api/nav/destinations"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.frameId").value("map"))
                .andExpect(jsonPath("$.count").value(1))
                .andExpect(jsonPath("$.destinations[0].id").value("T4"))
                .andExpect(jsonPath("$.destinations[0].x").value(23.226))
                .andExpect(jsonPath("$.destinations[0].y").value(9.241))
                .andExpect(jsonPath("$.destinations[0].yaw").value(0.0));
    }

    // ── sending a robot ──────────────────────────────────────────────────────

    @Test
    void publishesTheResolvedPose() throws Exception {
        mockMvc.perform(post("/api/nav/goTo")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(goal("T4")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sent").value(true))
                .andExpect(jsonPath("$.robotId").value(1))
                .andExpect(jsonPath("$.destination").value("T4"))
                .andExpect(jsonPath("$.x").value(23.226))
                .andExpect(jsonPath("$.y").value(9.241));

        // The map lookup is the part that can silently go wrong: a goal published
        // at the wrong coordinates still returns 200.
        verify(rosBridgeService).publishGoal(1, 23.226, 9.241, 0.0);
    }

    @Test
    void reportsAnUnknownDestinationAsNotFound() throws Exception {
        mockMvc.perform(post("/api/nav/goTo")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(goal("T99")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.sent").value(false))
                .andExpect(jsonPath("$.error").value("Unknown destination: T99"));

        verify(rosBridgeService, never())
                .publishGoal(anyInt(), anyDouble(), anyDouble(), anyDouble());
    }

    @Test
    void refusesWhenRosbridgeIsDown() throws Exception {
        when(rosBridgeService.isConnected()).thenReturn(false);

        mockMvc.perform(post("/api/nav/goTo")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(goal("T4")))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.sent").value(false))
                .andExpect(jsonPath("$.error").value("rosbridge not connected"));

        verify(rosBridgeService, never())
                .publishGoal(anyInt(), anyDouble(), anyDouble(), anyDouble());
    }

    @Test
    void reportsAFailedPublishAsABadGateway() throws Exception {
        // Distinct from 503 on purpose: the link was up and the write still failed,
        // so retrying is reasonable in a way it is not for a disconnected bridge.
        Mockito.doThrow(new IllegalStateException("send limit exceeded"))
                .when(rosBridgeService)
                .publishGoal(anyInt(), anyDouble(), anyDouble(), anyDouble());

        mockMvc.perform(post("/api/nav/goTo")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(goal("T4")))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.sent").value(false))
                .andExpect(jsonPath("$.error")
                        .value("Failed to publish goal: send limit exceeded"));
    }
}
