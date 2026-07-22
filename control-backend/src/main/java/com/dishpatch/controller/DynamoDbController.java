package com.dishpatch.controller;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.DescribeTableRequest;
import software.amazon.awssdk.services.dynamodb.model.DescribeTableResponse;

@RestController
@RequestMapping("/api/dynamodb")
public class DynamoDbController {

    private final DynamoDbClient dynamoDbClient;
    private final String ordersTableName;

    public DynamoDbController(
            DynamoDbClient dynamoDbClient,
            @Value("${aws.tables.orders}") String ordersTableName
    ) {
        this.dynamoDbClient = dynamoDbClient;
        this.ordersTableName = ordersTableName;
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        try {
            DescribeTableResponse response =
                    dynamoDbClient.describeTable(
                            DescribeTableRequest.builder()
                                    .tableName(ordersTableName)
                                    .build()
                    );

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("connected", true);
            result.put("table", response.table().tableName());
            result.put("status", response.table().tableStatusAsString());

            return ResponseEntity.ok(result);

        } catch (Exception exception) {
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("connected", false);
            result.put("table", ordersTableName);
            result.put("error", exception.getMessage());

            return ResponseEntity
                    .internalServerError()
                    .body(result);
        }
    }
}