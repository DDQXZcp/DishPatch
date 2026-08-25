package com.dishpatch.order;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The order status contract, on both sides of the wire.
 *
 * <p>{@link OrderStatus#fromValue} is a {@code @JsonCreator}, so it sits directly
 * on the API boundary: it decides whether {@code PUT /api/orders/{id}} is a 200 or
 * a 400, and it is reached by request bodies rather than by our own code. The
 * {@code @JsonValue} side is the string DynamoDB and the control frontend both
 * store and read, so the exact casing is a contract with two other systems.
 */
class OrderStatusTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    // ── the stored form ──────────────────────────────────────────────────────

    @Test
    void serialisesAsTheCapitalisedWordBothOtherSystemsExpect() {
        assertEquals("Preparing", OrderStatus.PREPARING.getValue());
        assertEquals("Completed", OrderStatus.COMPLETED.getValue());
        assertEquals("Cancelled", OrderStatus.CANCELLED.getValue());
    }

    @Test
    void jacksonWritesTheValueRatherThanTheEnumName() throws Exception {
        // Without @JsonValue this would serialise as "PREPARING" and every order
        // written by the backend would disagree with every order written by the POS.
        assertEquals("\"Preparing\"",
                objectMapper.writeValueAsString(OrderStatus.PREPARING));
    }

    @Test
    void roundTripsThroughJson() throws Exception {
        for (OrderStatus status : OrderStatus.values()) {
            String json = objectMapper.writeValueAsString(status);
            assertEquals(status, objectMapper.readValue(json, OrderStatus.class));
        }
    }

    // ── parsing what arrives ─────────────────────────────────────────────────

    @Test
    void acceptsTheExactValue() {
        assertEquals(OrderStatus.PREPARING, OrderStatus.fromValue("Preparing"));
        assertEquals(OrderStatus.COMPLETED, OrderStatus.fromValue("Completed"));
        assertEquals(OrderStatus.CANCELLED, OrderStatus.fromValue("Cancelled"));
    }

    @Test
    void acceptsAnyCasing() {
        // Deliberate leniency: the POS and the control frontend have both sent
        // lowercase at different times.
        assertEquals(OrderStatus.PREPARING, OrderStatus.fromValue("preparing"));
        assertEquals(OrderStatus.COMPLETED, OrderStatus.fromValue("COMPLETED"));
        assertEquals(OrderStatus.CANCELLED, OrderStatus.fromValue("cAnCeLlEd"));
    }

    @Test
    void acceptsTheEnumNameToo() {
        assertEquals(OrderStatus.PREPARING, OrderStatus.fromValue("PREPARING"));
    }

    @Test
    void parsesFromJsonThroughTheCreator() throws Exception {
        assertEquals(OrderStatus.COMPLETED,
                objectMapper.readValue("\"Completed\"", OrderStatus.class));
        assertEquals(OrderStatus.COMPLETED,
                objectMapper.readValue("\"completed\"", OrderStatus.class));
    }

    // ── what it refuses ──────────────────────────────────────────────────────

    @Test
    void rejectsNull() {
        IllegalArgumentException thrown = assertThrows(
                IllegalArgumentException.class, () -> OrderStatus.fromValue(null));

        assertTrue(thrown.getMessage().contains("required"), thrown.getMessage());
    }

    @Test
    void rejectsBlank() {
        assertThrows(IllegalArgumentException.class, () -> OrderStatus.fromValue(""));
        assertThrows(IllegalArgumentException.class, () -> OrderStatus.fromValue("   "));
    }

    @Test
    void rejectsAnUnknownStatusAndSaysWhatIsAllowed() {
        // The message reaches the caller as the body of a 400, so it has to be
        // useful to whoever sent the request.
        IllegalArgumentException thrown = assertThrows(
                IllegalArgumentException.class, () -> OrderStatus.fromValue("Delivered"));

        assertTrue(thrown.getMessage().contains("Preparing"), thrown.getMessage());
        assertTrue(thrown.getMessage().contains("Completed"), thrown.getMessage());
        assertTrue(thrown.getMessage().contains("Cancelled"), thrown.getMessage());
    }

    @Test
    void doesNotMatchOnAPrefix() {
        // "Prep" is not Preparing. Substring matching here would silently accept
        // typos and write a status nothing else recognises.
        assertThrows(IllegalArgumentException.class, () -> OrderStatus.fromValue("Prep"));
    }
}
