package com.dishpatch;

import com.dishpatch.config.CorsConfig;
import com.dishpatch.config.WebSocketConfig;
import com.dishpatch.controller.DynamoDbController;
import com.dishpatch.controller.NavTestController;
import com.dishpatch.dispatch.DispatchController;
import com.dishpatch.dispatch.DispatchService;
import com.dishpatch.map.DropPointService;
import com.dishpatch.order.OrderController;
import com.dishpatch.order.OrderRepository;
import com.dishpatch.order.OrderService;
import com.dishpatch.service.RobotService;
import com.dishpatch.service.RosBridgeService;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.TestPropertySource;

import software.amazon.awssdk.services.dynamodb.DynamoDbClient;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The application assembles.
 *
 * <p>Everything else in this suite constructs its subject with {@code new}, so
 * nothing else here would notice a bean that cannot be built, a constructor Spring
 * cannot choose, a {@code ${...}} placeholder with no value, or a
 * {@code @ConditionalOnProperty} that stopped matching. Those failures happen at
 * startup, and until this existed the only way to see one was to deploy.
 *
 * <p>Three beans are replaced, all of them for reaching outside the process:
 * {@link RosBridgeService} opens a WebSocket from a {@code @PostConstruct} and
 * retries forever, {@link DynamoDbClient} would resolve credentials, and
 * {@link OrderRepository} scans a real table on the broadcast tick. Everything
 * else is the real thing, which is the point — {@code DynamoDbConfig},
 * {@code WebSocketConfig} and {@code CorsConfig} all get built for real.
 *
 * <p>Scheduling stays on. {@code dispatch.enabled=false} makes the dispatch tick a
 * no-op rather than removing it, so the wiring is still exercised.
 */
@SpringBootTest
@TestPropertySource(properties = {
        // Commands real robots. Off here, but the bean is still built and scheduled.
        "dispatch.enabled=false",

        // Neutralises application.properties' `optional:file:./.env` import. An
        // imported file outranks the document that imports it, and the flag comment
        // in application.properties actively tells developers to put
        // nav.test-endpoint.enabled in a local .env for bench work — without this,
        // anyone who did would get a red suite from a cause unrelated to their
        // change. Cleared here so the assertions below read the checked-in defaults.
        "spring.config.import=",
})
class ApplicationContextTest {

    @MockBean
    private RosBridgeService rosBridgeService;

    @MockBean
    private DynamoDbClient dynamoDbClient;

    @MockBean
    private OrderRepository orderRepository;

    @Autowired
    private ApplicationContext context;

    @Test
    void theContextStarts() {
        assertNotNull(context);
    }

    @Test
    void everyBeanTheDispatchPipelineNeedsIsPresent() {
        // Named individually rather than counted: a count passes when one bean is
        // swapped for another, which is the mistake worth catching.
        assertNotNull(context.getBean(DispatchService.class));
        assertNotNull(context.getBean(DropPointService.class));
        assertNotNull(context.getBean(RobotService.class));
        assertNotNull(context.getBean(OrderService.class));
    }

    @Test
    void theWebLayerIsWired() {
        assertNotNull(context.getBean(DispatchController.class));
        assertNotNull(context.getBean(OrderController.class));
        assertNotNull(context.getBean(DynamoDbController.class));
        assertNotNull(context.getBean(CorsConfig.class));
        // By concrete type: Spring Boot registers a WebSocketMessageBrokerConfigurer
        // of its own, so the interface matches two beans.
        assertNotNull(context.getBean(WebSocketConfig.class));
    }

    @Test
    void dispatchServiceHasExactlyOneConstructorSpringCanChoose() {
        // Replaces DispatchAssignmentTest's reflection check with the real thing:
        // if Spring could not pick a constructor, the context above would not have
        // started at all. This asserts the bean it built is usable.
        DispatchService dispatchService = context.getBean(DispatchService.class);

        assertFalse(dispatchService.isEnabled(),
                "dispatch.enabled=false should have reached the bean");
        assertNotNull(dispatchService.assignments());
    }

    @Test
    void theDropPointMapIsLoadedAtStartup() {
        // @PostConstruct load() reads the staged file. A broken staging step fails
        // the context rather than the first delivery.
        DropPointService dropPoints = context.getBean(DropPointService.class);

        assertEquals(26, dropPoints.all().size(),
                "run map-source/stage-map-assets.sh");
        assertTrue(dropPoints.find("counter").isPresent());
    }

    @Test
    void theNavTestEndpointIsNotRegistered() {
        // It is unauthenticated and it commands physical robots. The default in
        // application.properties is false, and it has been left on in production
        // once already, so the default is worth asserting rather than trusting.
        assertFalse(
                context.getBeanNamesForType(NavTestController.class).length > 0,
                "NavTestController is registered; nav.test-endpoint.enabled is on");
    }
}
