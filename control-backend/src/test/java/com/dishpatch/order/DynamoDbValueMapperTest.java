package com.dishpatch.order;

import org.junit.jupiter.api.Test;
import software.amazon.awssdk.core.SdkBytes;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Translation from DynamoDB's tagged values to the plain maps the API returns.
 *
 * <p>Every order the control frontend and the dispatcher ever see passes through
 * here. The mapper is total by design — an unrecognised value becomes null rather
 * than throwing — which is the right call for a scan over a table the POS writes,
 * and also the reason a mistake here is invisible: a mistranslated field arrives
 * as a missing field, and the order simply looks incomplete.
 *
 * <p>In this package because the mapper is package-private.
 */
class DynamoDbValueMapperTest {

    private static Map<String, Object> map(String key, AttributeValue value) {
        return DynamoDbValueMapper.toJavaMap(Map.of(key, value));
    }

    private static Object value(AttributeValue attributeValue) {
        return map("k", attributeValue).get("k");
    }

    // ── scalars ──────────────────────────────────────────────────────────────

    @Test
    void readsAString() {
        assertEquals("order-1", value(AttributeValue.builder().s("order-1").build()));
    }

    @Test
    void readsANumberAsBigDecimal() {
        // BigDecimal rather than double: order totals are money, and the frontend
        // renders whatever precision is stored.
        Object result = value(AttributeValue.builder().n("42.50").build());

        assertInstanceOf(BigDecimal.class, result);
        assertEquals(new BigDecimal("42.50"), result);
    }

    @Test
    void keepsAMalformedNumberAsItsRawString() {
        // A number attribute that will not parse is data we still want to surface,
        // not an exception mid-scan that loses every other order in the page.
        assertEquals("not-a-number",
                value(AttributeValue.builder().n("not-a-number").build()));
    }

    @Test
    void readsABoolean() {
        assertEquals(true, value(AttributeValue.builder().bool(true).build()));
        assertEquals(false, value(AttributeValue.builder().bool(false).build()));
    }

    @Test
    void readsAnExplicitNull() {
        assertNull(value(AttributeValue.builder().nul(true).build()));
    }

    @Test
    void readsBinaryAsBase64() {
        AttributeValue binary = AttributeValue.builder()
                .b(SdkBytes.fromString("hi", StandardCharsets.UTF_8))
                .build();

        assertEquals("aGk=", value(binary));
    }

    // ── nested shapes ────────────────────────────────────────────────────────

    @Test
    void readsANestedMap() {
        // The shape OrderService.normalizeOrder flattens: orders carry their table
        // as a nested object written by the POS.
        AttributeValue table = AttributeValue.builder()
                .m(Map.of(
                        "tableNo", AttributeValue.builder().s("T6").build(),
                        "seats", AttributeValue.builder().n("4").build()))
                .build();

        Object result = value(table);

        assertInstanceOf(Map.class, result);
        Map<?, ?> nested = (Map<?, ?>) result;
        assertEquals("T6", nested.get("tableNo"));
        assertEquals(new BigDecimal("4"), nested.get("seats"));
    }

    @Test
    void readsAListOfMixedTypes() {
        AttributeValue items = AttributeValue.builder()
                .l(List.of(
                        AttributeValue.builder().s("Laksa").build(),
                        AttributeValue.builder().n("2").build(),
                        AttributeValue.builder().bool(true).build()))
                .build();

        assertEquals(List.of("Laksa", new BigDecimal("2"), true), value(items));
    }

    @Test
    void readsDeeplyNestedStructures() {
        // Order items are a list of maps, so the recursion has to hold two levels
        // down, not just one.
        AttributeValue orderItems = AttributeValue.builder()
                .l(List.of(AttributeValue.builder()
                        .m(Map.of("name", AttributeValue.builder().s("Laksa").build()))
                        .build()))
                .build();

        List<?> items = (List<?>) value(orderItems);
        Map<?, ?> first = (Map<?, ?>) items.get(0);

        assertEquals("Laksa", first.get("name"));
    }

    @Test
    void readsAStringSet() {
        Object result = value(AttributeValue.builder().ss("a", "b").build());

        assertInstanceOf(List.class, result);
        assertTrue(((List<?>) result).containsAll(List.of("a", "b")));
    }

    @Test
    void readsANumberSet() {
        Object result = value(AttributeValue.builder().ns("1", "2").build());

        assertEquals(List.of(new BigDecimal("1"), new BigDecimal("2")), result);
    }

    // ── the whole item ───────────────────────────────────────────────────────

    @Test
    void mapsAnEmptyItemToAnEmptyMap() {
        assertEquals(Map.of(), DynamoDbValueMapper.toJavaMap(Map.of()));
    }

    @Test
    void anAttributeWithNothingSetBecomesNull() {
        // Not reachable from a well-formed table, but the mapper's final fallthrough
        // is what stops an unknown future type from throwing mid-scan.
        assertNull(value(AttributeValue.builder().build()));
    }

    @Test
    void keepsTheOrderOfTheItemsKeys() {
        // LinkedHashMap, not HashMap: the JSON the frontend receives should not
        // reshuffle its fields between requests.
        Map<String, AttributeValue> item = new LinkedHashMap<>();
        item.put("orderId", AttributeValue.builder().s("o-1").build());
        item.put("orderDate", AttributeValue.builder().s("2026-08-11").build());
        item.put("orderStatus", AttributeValue.builder().s("Preparing").build());

        assertEquals(
                new ArrayList<>(item.keySet()),
                new ArrayList<>(DynamoDbValueMapper.toJavaMap(item).keySet()));
    }

    @Test
    void mapsAnOrderShapedItemWhole() {
        Map<String, AttributeValue> item = new LinkedHashMap<>();
        item.put("orderId", AttributeValue.builder().s("o-1").build());
        item.put("orderStatus", AttributeValue.builder().s("Preparing").build());
        item.put("total", AttributeValue.builder().n("18.90").build());
        item.put("paid", AttributeValue.builder().bool(false).build());
        item.put("note", AttributeValue.builder().nul(true).build());
        item.put("table", AttributeValue.builder()
                .m(Map.of("tableNo", AttributeValue.builder().s("T6").build()))
                .build());

        Map<String, Object> order = DynamoDbValueMapper.toJavaMap(item);

        assertEquals("o-1", order.get("orderId"));
        assertEquals("Preparing", order.get("orderStatus"));
        assertEquals(new BigDecimal("18.90"), order.get("total"));
        assertEquals(false, order.get("paid"));
        assertNull(order.get("note"));
        assertEquals("T6", ((Map<?, ?>) order.get("table")).get("tableNo"));
    }
}
