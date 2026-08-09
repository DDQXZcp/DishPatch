package com.dishpatch.order;

import software.amazon.awssdk.services.dynamodb.model.AttributeValue;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class DynamoDbValueMapper {

    private DynamoDbValueMapper() {
    }

    public static Map<String, Object> toJavaMap(
            Map<String, AttributeValue> dynamoDbItem
    ) {
        Map<String, Object> result = new LinkedHashMap<>();

        dynamoDbItem.forEach(
                (key, value) ->
                        result.put(key, toJavaValue(value))
        );

        return result;
    }

    private static Object toJavaValue(AttributeValue value) {
        if (value == null || Boolean.TRUE.equals(value.nul())) {
            return null;
        }

        if (value.s() != null) {
            return value.s();
        }

        if (value.n() != null) {
            try {
                return new BigDecimal(value.n());
            } catch (NumberFormatException exception) {
                return value.n();
            }
        }

        if (value.bool() != null) {
            return value.bool();
        }

        if (value.hasM()) {
            return toJavaMap(value.m());
        }

        if (value.hasL()) {
            List<Object> result = new ArrayList<>();

            for (AttributeValue item : value.l()) {
                result.add(toJavaValue(item));
            }

            return result;
        }

        if (value.hasSs()) {
            return new ArrayList<>(value.ss());
        }

        if (value.hasNs()) {
            return value.ns()
                    .stream()
                    .map(BigDecimal::new)
                    .toList();
        }

        if (value.b() != null) {
            return Base64.getEncoder().encodeToString(
                    value.b().asByteArray()
            );
        }

        return null;
    }
}