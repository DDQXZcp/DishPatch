package com.dishpatch.order;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The shape an order has by the time anything else sees it.
 *
 * <p>{@code normalizeOrder} is a contract with two consumers that cannot see each
 * other. The control frontend reads {@code status} and {@code createdAt}, which do
 * not exist in DynamoDB and are invented here; {@code DispatchService} reads
 * {@code tableNo}, which the POS writes as a nested object. Rename or drop one of
 * these and nothing fails to compile — an order simply stops being deliverable, or
 * renders blank.
 */
class OrderServiceTest {

    private OrderRepository orderRepository;
    private SimpMessagingTemplate messagingTemplate;
    private OrderService orderService;

    @BeforeEach
    void setUp() {
        orderRepository = Mockito.mock(OrderRepository.class);
        messagingTemplate = Mockito.mock(SimpMessagingTemplate.class);
        orderService = new OrderService(orderRepository, messagingTemplate);
    }

    /** An order as DynamoDB holds it, before normalising. */
    private static Map<String, Object> stored(Object... keysAndValues) {
        Map<String, Object> order = new LinkedHashMap<>();

        for (int i = 0; i < keysAndValues.length; i += 2) {
            order.put(String.valueOf(keysAndValues[i]), keysAndValues[i + 1]);
        }

        return order;
    }

    private Map<String, Object> normalisedFrom(Map<String, Object> storedOrder) {
        Mockito.when(orderRepository.findAll()).thenReturn(List.of(storedOrder));
        return orderService.getOrders().get(0);
    }

    // ── the status field ─────────────────────────────────────────────────────

    @Test
    void defaultsAMissingStatusToPreparing() {
        // An order the POS wrote without a status is still owed to a table, so it
        // has to enter the dispatch queue rather than being ignored.
        Map<String, Object> order = normalisedFrom(stored("orderId", "o-1"));

        assertEquals("Preparing", order.get("orderStatus"));
        assertEquals("Preparing", order.get("status"));
    }

    @Test
    void keepsAStatusThatIsAlreadySet() {
        Map<String, Object> order =
                normalisedFrom(stored("orderId", "o-1", "orderStatus", "Completed"));

        assertEquals("Completed", order.get("orderStatus"));
    }

    @Test
    void addsTheStatusAliasTheFrontendReads() {
        Map<String, Object> order =
                normalisedFrom(stored("orderId", "o-1", "orderStatus", "Cancelled"));

        assertEquals(order.get("orderStatus"), order.get("status"),
                "the alias must not drift from the field it aliases");
    }

    @Test
    void addsCreatedAtFromOrderDate() {
        Map<String, Object> order = normalisedFrom(
                stored("orderId", "o-1", "orderDate", "2026-08-11T05:49:00Z"));

        assertEquals("2026-08-11T05:49:00Z", order.get("createdAt"));
    }

    // ── the table ────────────────────────────────────────────────────────────

    @Test
    void flattensTheNestedTableThePosWrites() {
        // This is the field DispatchService routes on. A nested object left
        // unflattened makes every order undeliverable.
        Map<String, Object> order = normalisedFrom(stored(
                "orderId", "o-1",
                "table", Map.of("tableNo", "T6", "seats", 4)));

        assertEquals("T6", order.get("tableNo"));
    }

    @Test
    void passesAScalarTableStraightThrough() {
        Map<String, Object> order =
                normalisedFrom(stored("orderId", "o-1", "table", "T9"));

        assertEquals("T9", order.get("tableNo"));
    }

    @Test
    void leavesTableNoNullWhenThereIsNoTable() {
        // Not an error here — DispatchService skips it with "Order has no table",
        // which is a reportable state rather than a crash.
        Map<String, Object> order = normalisedFrom(stored("orderId", "o-1"));

        assertTrue(order.containsKey("tableNo"));
        assertNull(order.get("tableNo"));
    }

    // ── the list ─────────────────────────────────────────────────────────────

    @Test
    void returnsNewestFirst() {
        Mockito.when(orderRepository.findAll()).thenReturn(List.of(
                stored("orderId", "middle", "orderDate", "2026-08-11T05:30:00Z"),
                stored("orderId", "oldest", "orderDate", "2026-08-11T05:00:00Z"),
                stored("orderId", "newest", "orderDate", "2026-08-11T06:00:00Z")));

        assertEquals(List.of("newest", "middle", "oldest"),
                orderService.getOrders().stream().map(o -> o.get("orderId")).toList());
    }

    @Test
    void sortsAnOrderWithNoDateLast() {
        Mockito.when(orderRepository.findAll()).thenReturn(List.of(
                stored("orderId", "undated"),
                stored("orderId", "dated", "orderDate", "2026-08-11T05:00:00Z")));

        assertEquals(List.of("dated", "undated"),
                orderService.getOrders().stream().map(o -> o.get("orderId")).toList());
    }

    @Test
    void doesNotMutateWhatTheRepositoryReturned() {
        // normalizeOrder copies. Writing the aliases into the repository's own map
        // would mean a second read saw a different shape than the first.
        Map<String, Object> storedOrder = stored("orderId", "o-1");
        Mockito.when(orderRepository.findAll()).thenReturn(List.of(storedOrder));

        orderService.getOrders();

        assertEquals(Map.of("orderId", "o-1"), storedOrder);
    }

    // ── single order and update ──────────────────────────────────────────────

    @Test
    void normalisesASingleOrderToo() {
        Mockito.when(orderRepository.findById("o-1"))
                .thenReturn(Optional.of(stored("orderId", "o-1", "table", "T3")));

        assertEquals("T3", orderService.getOrder("o-1").orElseThrow().get("tableNo"));
    }

    @Test
    void isEmptyForAnUnknownOrder() {
        Mockito.when(orderRepository.findById("nope")).thenReturn(Optional.empty());

        assertTrue(orderService.getOrder("nope").isEmpty());
    }

    @Test
    void normalisesTheOrderReturnedByAnUpdate() {
        Mockito.when(orderRepository.updateStatus("o-1", OrderStatus.COMPLETED))
                .thenReturn(Optional.of(
                        stored("orderId", "o-1", "orderStatus", "Completed",
                                "orderDate", "2026-08-11T05:00:00Z")));

        Map<String, Object> updated =
                orderService.updateStatus("o-1", OrderStatus.COMPLETED).orElseThrow();

        assertEquals("Completed", updated.get("status"));
        assertEquals("2026-08-11T05:00:00Z", updated.get("createdAt"));
    }

    @Test
    void isEmptyWhenTheOrderToUpdateIsGone() {
        Mockito.when(orderRepository.updateStatus("nope", OrderStatus.COMPLETED))
                .thenReturn(Optional.empty());

        assertTrue(orderService.updateStatus("nope", OrderStatus.COMPLETED).isEmpty());
    }

    // ── the broadcast ────────────────────────────────────────────────────────

    @Test
    void pushesTheOrderListToTheFrontend() {
        Mockito.when(orderRepository.findAll())
                .thenReturn(List.of(stored("orderId", "o-1")));

        orderService.broadcastOrders();

        Mockito.verify(messagingTemplate)
                .convertAndSend(Mockito.eq("/topic/orders"), Mockito.<Object>any());
    }

    @Test
    void aFailedBroadcastDoesNotKillTheScheduler() {
        // Thrown out of a @Scheduled method this would stop the fixed-delay loop
        // for the life of the process, and the frontend's order list would freeze
        // with no error anywhere.
        Mockito.when(orderRepository.findAll())
                .thenThrow(new RuntimeException("DynamoDB is having a moment"));

        assertDoesNotThrow(() -> orderService.broadcastOrders());
    }
}
