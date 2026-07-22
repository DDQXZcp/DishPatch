package com.dishpatch.order;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Repository;

import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;
import software.amazon.awssdk.services.dynamodb.model.ConditionalCheckFailedException;
import software.amazon.awssdk.services.dynamodb.model.GetItemRequest;
import software.amazon.awssdk.services.dynamodb.model.GetItemResponse;
import software.amazon.awssdk.services.dynamodb.model.ReturnValue;
import software.amazon.awssdk.services.dynamodb.model.ScanRequest;
import software.amazon.awssdk.services.dynamodb.model.ScanResponse;
import software.amazon.awssdk.services.dynamodb.model.UpdateItemRequest;
import software.amazon.awssdk.services.dynamodb.model.UpdateItemResponse;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Repository
public class OrderRepository {

    private final DynamoDbClient dynamoDbClient;
    private final String ordersTableName;

    public OrderRepository(
            DynamoDbClient dynamoDbClient,
            @Value("${aws.tables.orders}")
            String ordersTableName
    ) {
        this.dynamoDbClient = dynamoDbClient;
        this.ordersTableName = ordersTableName;
    }

    public List<Map<String, Object>> findAll() {
        List<Map<String, Object>> orders = new ArrayList<>();

        Map<String, AttributeValue> lastEvaluatedKey = null;

        do {
            ScanRequest.Builder requestBuilder =
                    ScanRequest.builder()
                            .tableName(ordersTableName);

            if (lastEvaluatedKey != null
                    && !lastEvaluatedKey.isEmpty()) {
                requestBuilder.exclusiveStartKey(
                        lastEvaluatedKey
                );
            }

            ScanResponse response =
                    dynamoDbClient.scan(requestBuilder.build());

            response.items()
                    .stream()
                    .map(DynamoDbValueMapper::toJavaMap)
                    .forEach(orders::add);

            lastEvaluatedKey = response.lastEvaluatedKey();

        } while (
                lastEvaluatedKey != null
                        && !lastEvaluatedKey.isEmpty()
        );

        return orders;
    }

    public Optional<Map<String, Object>> findById(
            String orderId
    ) {
        GetItemResponse response = dynamoDbClient.getItem(
                GetItemRequest.builder()
                        .tableName(ordersTableName)
                        .key(Map.of(
                                "orderId",
                                AttributeValue.builder()
                                        .s(orderId)
                                        .build()
                        ))
                        .build()
        );

        if (!response.hasItem() || response.item().isEmpty()) {
            return Optional.empty();
        }

        return Optional.of(
                DynamoDbValueMapper.toJavaMap(response.item())
        );
    }

    public Optional<Map<String, Object>> updateStatus(
            String orderId,
            OrderStatus status
    ) {
        try {
            UpdateItemResponse response =
                    dynamoDbClient.updateItem(
                            UpdateItemRequest.builder()
                                    .tableName(ordersTableName)
                                    .key(Map.of(
                                            "orderId",
                                            AttributeValue.builder()
                                                    .s(orderId)
                                                    .build()
                                    ))
                                    .updateExpression(
                                            "SET #status = :status"
                                    )
                                    .conditionExpression(
                                            "attribute_exists(#orderId)"
                                    )
                                    .expressionAttributeNames(Map.of(
                                            "#orderId",
                                            "orderId",
                                            "#status",
                                            "orderStatus"
                                    ))
                                    .expressionAttributeValues(Map.of(
                                            ":status",
                                            AttributeValue.builder()
                                                    .s(status.getValue())
                                                    .build()
                                    ))
                                    .returnValues(ReturnValue.ALL_NEW)
                                    .build()
                    );

            return Optional.of(
                    DynamoDbValueMapper.toJavaMap(
                            response.attributes()
                    )
            );

        } catch (ConditionalCheckFailedException exception) {
            return Optional.empty();
        }
    }
}