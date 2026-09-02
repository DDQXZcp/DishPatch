package com.dishpatch.controller;

import com.dishpatch.map.DropPointService;
import com.dishpatch.service.RosBridgeService;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The nav endpoint stays off unless someone turns it on.
 *
 * <p>This is a security test, not a formality. The endpoint is unauthenticated and
 * it drives physical robots around a room with people in it, and
 * {@code application.properties} records that it was shipped to production enabled
 * once already despite the comment directly above the flag saying not to.
 *
 * <p>The guard is one {@code @ConditionalOnProperty}. Nothing else in the build
 * notices if it is removed, mistyped, or if the default flips — every other test
 * in the suite passes either way, and so does the deploy.
 */
@WebMvcTest(NavTestController.class)
@TestPropertySource(properties = "nav.test-endpoint.enabled=false")
class NavTestControllerDisabledTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private DropPointService dropPointService;

    @MockBean
    private RosBridgeService rosBridgeService;

    @Test
    void theHealthRouteIsNotRegistered() throws Exception {
        mockMvc.perform(get("/api/nav/health"))
                .andExpect(status().isNotFound());
    }

    @Test
    void theDestinationsRouteIsNotRegistered() throws Exception {
        mockMvc.perform(get("/api/nav/destinations"))
                .andExpect(status().isNotFound());
    }

    @Test
    void aGoalCannotBePublishedThroughIt() throws Exception {
        // The one that matters: no route, and nothing reaches a robot.
        mockMvc.perform(post("/api/nav/goTo")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"robotId\":1,\"destination\":\"T4\"}"))
                .andExpect(status().isNotFound());

        verify(rosBridgeService, never())
                .publishGoal(anyInt(), anyDouble(), anyDouble(), anyDouble());
    }
}
