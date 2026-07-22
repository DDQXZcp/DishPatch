package com.dishpatch.order;

import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class OrderService {

    private final OrderRepository orderRepository;

    public OrderService(OrderRepository orderRepository) {
        this.orderRepository = orderRepository;
    }

    public List<Map<String, Object>> getOrders() {
        return orderRepository.findAll()
                .stream()
                .map(this::normalizeOrder)
                .sorted(
                        Comparator.comparing(
                                order -> String.valueOf(
                                        order.getOrDefault(
                                                "orderDate",
                                                ""
                                        )
                                ),
                                Comparator.reverseOrder()
                        )
                )
                .toList();
    }

    public Optional<Map<String, Object>> getOrder(
            String orderId
    ) {
        return orderRepository.findById(orderId)
                .map(this::normalizeOrder);
    }

    public Optional<Map<String, Object>> updateStatus(
            String orderId,
            OrderStatus status
    ) {
        return orderRepository.updateStatus(orderId, status)
                .map(this::normalizeOrder);
    }

    private Map<String, Object> normalizeOrder(
            Map<String, Object> originalOrder
    ) {
        Map<String, Object> order =
                new LinkedHashMap<>(originalOrder);

        Object rawStatus = order.get("orderStatus");

        String status = rawStatus == null
                ? OrderStatus.PREPARING.getValue()
                : rawStatus.toString();

        order.put("orderStatus", status);

        // Convenience aliases for the control frontend.
        order.put("status", status);
        order.put("createdAt", order.get("orderDate"));

        Object table = order.get("table");

        if (table instanceof Map<?, ?> tableMap) {
            order.put("tableNo", tableMap.get("tableNo"));
        } else {
            order.put("tableNo", table);
        }

        return order;
    }
}