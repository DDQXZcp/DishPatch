package com.dishpatch.dispatch;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The diagnostic endpoint's wire format.
 *
 * <p>{@code /api/dispatch} exists to answer "why is nothing being delivered" when
 * the robot stream cannot tell no-orders apart from rosbridge-down. That makes the
 * field names the whole product: a renamed field does not break the build, it
 * breaks the one tool available during an incident.
 *
 * <p>A real request through Spring's dispatcher and real Jackson serialisation,
 * with the service beneath mocked — so this pins the JSON, not the logic.
 */
@WebMvcTest(DispatchController.class)
class DispatchControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private DispatchService dispatchService;

    /** A pipeline with nothing in flight. */
    private void idlePipeline() {
        when(dispatchService.isEnabled()).thenReturn(true);
        when(dispatchService.isRosbridgeConnected()).thenReturn(true);
        when(dispatchService.millisSinceLastTick()).thenReturn(250L);
        when(dispatchService.queuedOrders()).thenReturn(0);
        when(dispatchService.freeRobotIds()).thenReturn(List.of(1, 2));
        when(dispatchService.assignments()).thenReturn(List.of());
        when(dispatchService.skipped()).thenReturn(Map.of());
    }

    @Test
    void reportsAnIdlePipeline() throws Exception {
        idlePipeline();

        mockMvc.perform(get("/api/dispatch"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(true))
                .andExpect(jsonPath("$.rosbridgeConnected").value(true))
                .andExpect(jsonPath("$.millisSinceLastTick").value(250))
                .andExpect(jsonPath("$.queuedOrders").value(0))
                .andExpect(jsonPath("$.freeRobots[0]").value(1))
                .andExpect(jsonPath("$.freeRobots[1]").value(2))
                .andExpect(jsonPath("$.active").isEmpty())
                .andExpect(jsonPath("$.skipped").isEmpty());
    }

    @Test
    void reportsADeliveryInFlightWithEveryFieldTheDashboardReads() throws Exception {
        idlePipeline();

        DispatchAssignment assignment = new DispatchAssignment(
                "o-1", 3, "T6", DispatchState.TO_TABLE, 0L, 2, 0L);

        when(dispatchService.assignments()).thenReturn(List.of(assignment));
        when(dispatchService.millisRemaining(any())).thenReturn(0L);
        when(dispatchService.metresToGo(any())).thenReturn(4.25);
        when(dispatchService.isNavigating(anyInt())).thenReturn(true);
        when(dispatchService.isRobotStale(anyInt())).thenReturn(false);
        when(dispatchService.hasGoalFailed(anyInt())).thenReturn(false);

        mockMvc.perform(get("/api/dispatch"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active[0].orderId").value("o-1"))
                .andExpect(jsonPath("$.active[0].robotId").value(3))
                .andExpect(jsonPath("$.active[0].destination").value("T6"))
                .andExpect(jsonPath("$.active[0].millisRemaining").value(0))
                .andExpect(jsonPath("$.active[0].metresToGo").value(4.25))
                .andExpect(jsonPath("$.active[0].navigating").value(true))
                .andExpect(jsonPath("$.active[0].robotStale").value(false))
                .andExpect(jsonPath("$.active[0].attempts").value(2))
                .andExpect(jsonPath("$.active[0].goalFailed").value(false));
    }

    @Test
    void wiresEachDiagnosticBooleanToItsOwnSource() throws Exception {
        // navigating, robotStale and goalFailed are three same-typed arguments in a
        // ten-argument record constructor, and an incident is diagnosed by reading
        // them against each other. Exercised one-hot, because false is Mockito's
        // default for a boolean: with all three false, transposing any pair — or
        // hardcoding one — passes without a murmur.
        idlePipeline();
        when(dispatchService.assignments()).thenReturn(List.of(
                new DispatchAssignment("o-1", 3, "T6", DispatchState.TO_TABLE, 0L, 1, 0L)));

        boolean[][] oneHot = {
                { true, false, false },
                { false, true, false },
                { false, false, true },
        };

        for (boolean[] flags : oneHot) {
            when(dispatchService.isNavigating(anyInt())).thenReturn(flags[0]);
            when(dispatchService.isRobotStale(anyInt())).thenReturn(flags[1]);
            when(dispatchService.hasGoalFailed(anyInt())).thenReturn(flags[2]);

            mockMvc.perform(get("/api/dispatch"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.active[0].navigating").value(flags[0]))
                    .andExpect(jsonPath("$.active[0].robotStale").value(flags[1]))
                    .andExpect(jsonPath("$.active[0].goalFailed").value(flags[2]));
        }
    }

    @Test
    void serialisesTheStageAsItsName() throws Exception {
        // The frontend switches on this string. Jackson's default for an enum is
        // the constant name, and nothing else pins it.
        idlePipeline();
        when(dispatchService.assignments()).thenReturn(List.of(
                new DispatchAssignment("o-1", 3, "T6", DispatchState.AT_TABLE, 0L, 1, 0L)));

        mockMvc.perform(get("/api/dispatch"))
                .andExpect(jsonPath("$.active[0].state").value("AT_TABLE"));
    }

    @Test
    void neverLeaksTheAbsoluteDeadline() throws Exception {
        // deadlineMillis is internal and unreadable without date maths; the view
        // reports time remaining instead. Documented, so worth enforcing.
        idlePipeline();
        when(dispatchService.assignments()).thenReturn(List.of(
                new DispatchAssignment("o-1", 3, "T6", DispatchState.TO_TABLE,
                        1_760_000_000_000L, 1, 0L)));

        mockMvc.perform(get("/api/dispatch"))
                .andExpect(jsonPath("$.active[0].deadlineMillis").doesNotExist())
                .andExpect(jsonPath("$.active[0].goalPublishedAtMillis").doesNotExist());
    }

    @Test
    void reportsSkippedOrdersAsAListRatherThanAMap() throws Exception {
        idlePipeline();
        when(dispatchService.skipped())
                .thenReturn(Map.of("o-9", "Unknown destination: T99"));

        mockMvc.perform(get("/api/dispatch"))
                .andExpect(jsonPath("$.skipped[0].orderId").value("o-9"))
                .andExpect(jsonPath("$.skipped[0].reason")
                        .value("Unknown destination: T99"));
    }

    @Test
    void reportsTheSentinelBeforeTheFirstTick() throws Exception {
        // -1 rather than 0: zero would read as "ticked just now", which is the
        // opposite of what it means and the first thing to check in an incident.
        idlePipeline();
        when(dispatchService.millisSinceLastTick()).thenReturn(-1L);

        mockMvc.perform(get("/api/dispatch"))
                .andExpect(jsonPath("$.millisSinceLastTick").value(-1));
    }

    @Test
    void answersTheControlFrontendsOrigin() throws Exception {
        // CorsConfig is a WebMvcConfigurer, so the slice picks it up. Without the
        // allowed origin the dashboard gets a CORS error rather than data.
        idlePipeline();

        mockMvc.perform(get("/api/dispatch").header("Origin", "http://localhost:5173"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin",
                        "http://localhost:5173"));
    }
}
