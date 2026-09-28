package com.dishpatch.order;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/orders")
public class OrderController {

    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    @GetMapping
    public ResponseEntity<
            ApiResponse<List<Map<String, Object>>>
    > getOrders() {
        return ResponseEntity.ok(
                new ApiResponse<>(
                        true,
                        null,
                        orderService.getOrders()
                )
        );
    }

    @GetMapping("/{id}")
    public ResponseEntity<
            ApiResponse<Map<String, Object>>
    > getOrderById(
            @PathVariable String id
    ) {
        return orderService.getOrder(id)
                .map(order ->
                        ResponseEntity.ok(
                                new ApiResponse<>(
                                        true,
                                        null,
                                        order
                                )
                        )
                )
                .orElseGet(() ->
                        ResponseEntity.status(404).body(
                                new ApiResponse<>(
                                        false,
                                        "Order not found",
                                        null
                                )
                        )
                );
    }

    @PutMapping("/{id}")
    public ResponseEntity<
            ApiResponse<Map<String, Object>>
    > updateOrder(
            @PathVariable String id,
            @Valid @RequestBody
            UpdateOrderRequest request
    ) {
        return orderService.updateStatus(
                        id,
                        request.orderStatus()
                )
                .map(order ->
                        ResponseEntity.ok(
                                new ApiResponse<>(
                                        true,
                                        "Order updated",
                                        order
                                )
                        )
                )
                .orElseGet(() ->
                        ResponseEntity.status(404).body(
                                new ApiResponse<>(
                                        false,
                                        "Order not found",
                                        null
                                )
                        )
                );
    }

    public record UpdateOrderRequest(
            @NotNull OrderStatus orderStatus
    ) {
    }

    public record ApiResponse<T>(
            boolean success,
            String message,
            T data
    ) {
    }
}