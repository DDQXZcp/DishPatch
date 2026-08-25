package com.dishpatch.controller;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.DescribeTableRequest;
import software.amazon.awssdk.services.dynamodb.model.DescribeTableResponse;
import software.amazon.awssdk.services.dynamodb.model.DynamoDbException;
import software.amazon.awssdk.services.dynamodb.model.TableDescription;
import software.amazon.awssdk.services.dynamodb.model.TableStatus;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The DynamoDB health probe.
 *
 * <p>Its value is entirely in the failure case: when orders stop appearing, this
 * is what separates "the table is unreachable" from "there are no orders". That
 * makes the 500 the important test — a health endpoint that reports 200 while the
 * table is down is worse than not having one.
 */
@WebMvcTest(DynamoDbController.class)
@TestPropertySource(properties = "aws.tables.orders=test-orders-table")
class DynamoDbControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private DynamoDbClient dynamoDbClient;

    @Test
    void reportsAReachableTable() throws Exception {
        when(dynamoDbClient.describeTable(any(DescribeTableRequest.class)))
                .thenReturn(DescribeTableResponse.builder()
                        .table(TableDescription.builder()
                                .tableName("test-orders-table")
                                .tableStatus(TableStatus.ACTIVE)
                                .build())
                        .build());

        mockMvc.perform(get("/api/dynamodb/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.connected").value(true))
                .andExpect(jsonPath("$.table").value("test-orders-table"))
                .andExpect(jsonPath("$.status").value("ACTIVE"));

        // The body above only echoes the stub, so on its own it would pass with the
        // probe pointed anywhere. This is the assertion that pins which table was
        // actually asked about — the failure the class exists to catch.
        ArgumentCaptor<DescribeTableRequest> request =
                ArgumentCaptor.forClass(DescribeTableRequest.class);
        verify(dynamoDbClient).describeTable(request.capture());

        assertEquals("test-orders-table", request.getValue().tableName());
    }

    @Test
    void reportsAnUnreachableTableAsAServerError() throws Exception {
        // 500 rather than 200-with-connected-false: a monitor watching status
        // codes has to see this, not just a human reading the body.
        when(dynamoDbClient.describeTable(any(DescribeTableRequest.class)))
                .thenThrow(DynamoDbException.builder()
                        .message("Requested resource not found")
                        .build());

        mockMvc.perform(get("/api/dynamodb/health"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.connected").value(false))
                .andExpect(jsonPath("$.table").value("test-orders-table"))
                .andExpect(jsonPath("$.error").exists());
    }

    @Test
    void namesTheTableItProbedEvenWhenTheProbeFailed() throws Exception {
        // Half of diagnosing this is finding out it was pointed at the wrong table.
        when(dynamoDbClient.describeTable(any(DescribeTableRequest.class)))
                .thenThrow(new RuntimeException("boom"));

        mockMvc.perform(get("/api/dynamodb/health"))
                .andExpect(jsonPath("$.table").value("test-orders-table"));
    }
}
