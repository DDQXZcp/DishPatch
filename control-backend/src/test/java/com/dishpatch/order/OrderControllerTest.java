package com.dishpatch.order;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The orders API as the POS and the control frontend call it.
 *
 * <p>Two things are pinned here that no other test can reach. The
 * {@code ApiResponse} envelope — {@code success}, {@code message}, {@code data} —
 * is what every caller unwraps, and it exists only in this controller. And the
 * rejection paths: {@code OrderStatus.fromValue} throws from inside Jackson, so
 * whether a bad status is a 400 or a 500 is decided by Spring's error handling
 * rather than by any code we wrote, and it has never been checked.
 */
@WebMvcTest(OrderController.class)
class OrderControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private OrderService orderService;

    private static Map<String, Object> order(String id, String status) {
        return Map.of("orderId", id, "orderStatus", status, "status", status);
    }

    // ── reading ──────────────────────────────────────────────────────────────

    @Test
    void listsOrdersInsideTheEnvelope() throws Exception {
        when(orderService.getOrders())
                .thenReturn(List.of(order("o-1", "Preparing")));

        mockMvc.perform(get("/api/orders"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].orderId").value("o-1"))
                .andExpect(jsonPath("$.data[0].orderStatus").value("Preparing"));
    }

    @Test
    void anEmptyTableIsStillASuccess() throws Exception {
        // Not a 404: no orders is a normal state, and the dashboard renders it.
        when(orderService.getOrders()).thenReturn(List.of());

        mockMvc.perform(get("/api/orders"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data").isEmpty());
    }

    @Test
    void returnsOneOrder() throws Exception {
        when(orderService.getOrder("o-1"))
                .thenReturn(Optional.of(order("o-1", "Preparing")));

        mockMvc.perform(get("/api/orders/o-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.orderId").value("o-1"));
    }

    @Test
    void reportsAnUnknownOrderAsNotFound() throws Exception {
        when(orderService.getOrder("nope")).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/orders/nope"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Order not found"))
                .andExpect(jsonPath("$.data").doesNotExist());
    }

    // ── updating ─────────────────────────────────────────────────────────────

    @Test
    void updatesAnOrdersStatus() throws Exception {
        when(orderService.updateStatus("o-1", OrderStatus.COMPLETED))
                .thenReturn(Optional.of(order("o-1", "Completed")));

        mockMvc.perform(put("/api/orders/o-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"orderStatus\":\"Completed\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Order updated"))
                .andExpect(jsonPath("$.data.orderStatus").value("Completed"));
    }

    @Test
    void acceptsALowercaseStatus() throws Exception {
        // fromValue is deliberately case-insensitive; this is the path that proves
        // the leniency survives Jackson rather than only holding in a unit test.
        when(orderService.updateStatus("o-1", OrderStatus.CANCELLED))
                .thenReturn(Optional.of(order("o-1", "Cancelled")));

        mockMvc.perform(put("/api/orders/o-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"orderStatus\":\"cancelled\"}"))
                .andExpect(status().isOk());
    }

    @Test
    void reportsAnUpdateToAMissingOrderAsNotFound() throws Exception {
        when(orderService.updateStatus(anyString(), any()))
                .thenReturn(Optional.empty());

        mockMvc.perform(put("/api/orders/nope")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"orderStatus\":\"Completed\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Order not found"));
    }

    // ── what it rejects ──────────────────────────────────────────────────────

    @Test
    void rejectsAnUnknownStatusAsABadRequest() throws Exception {
        // fromValue throws IllegalArgumentException from inside deserialization.
        // Unhandled that surfaces as a 500, which would tell the caller the server
        // is broken rather than that they sent a bad value.
        mockMvc.perform(put("/api/orders/o-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"orderStatus\":\"Delivered\"}"))
                .andExpect(status().isBadRequest());

        verify(orderService, never()).updateStatus(anyString(), any());
    }

    @Test
    void rejectsAMissingStatus() throws Exception {
        // @NotNull on the record component, via @Valid.
        mockMvc.perform(put("/api/orders/o-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());

        verify(orderService, never()).updateStatus(anyString(), any());
    }

    @Test
    void rejectsANullStatus() throws Exception {
        mockMvc.perform(put("/api/orders/o-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"orderStatus\":null}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void rejectsMalformedJson() throws Exception {
        mockMvc.perform(put("/api/orders/o-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{not json"))
                .andExpect(status().isBadRequest());
    }
}
