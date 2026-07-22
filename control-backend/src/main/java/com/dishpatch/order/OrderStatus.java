package com.dishpatch.order;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

import java.util.Arrays;

public enum OrderStatus {

    PREPARING("Preparing"),
    COMPLETED("Completed"),
    CANCELLED("Cancelled");

    private final String value;

    OrderStatus(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    @JsonCreator
    public static OrderStatus fromValue(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(
                    "Order status is required"
            );
        }

        return Arrays.stream(values())
                .filter(status ->
                        status.value.equalsIgnoreCase(value)
                                || status.name().equalsIgnoreCase(value)
                )
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException(
                        "Invalid order status. Allowed values: "
                                + "Preparing, Completed, Cancelled"
                ));
    }
}