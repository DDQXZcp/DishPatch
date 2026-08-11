package com.dishpatch.user;

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
import software.amazon.awssdk.services.dynamodb.model.PutItemRequest;
import software.amazon.awssdk.services.dynamodb.model.PutItemResponse;
import software.amazon.awssdk.services.dynamodb.model.QueryResponse;
import software.amazon.awssdk.services.dynamodb.model.QueryRequest;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.Optional;
import com.dishpatch.order.DynamoDbValueMapper;
import java.time.Instant;

@Repository
public class UserRepository {
    
    private final DynamoDbClient dynamoDbClient;
    private final String usersTableName;

    public UserRepository(
        DynamoDbClient dynamoDbClient,
        @Value("${aws.tables.users}")
        String usersTableName
    ) {
        this.dynamoDbClient = dynamoDbClient;
        this.usersTableName = usersTableName;
    }

    public Optional<Map<String, Object>> findById(String userId) {
        GetItemResponse response = dynamoDbClient.getItem(
            GetItemRequest.builder().tableName(usersTableName)
            .key(Map.of(
                "userId",
                AttributeValue.builder().s(userId).build()
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

    public Optional<Map<String, Object>> findByEmail(String email) {
        QueryRequest request = QueryRequest.builder()
            .tableName(usersTableName)
            .indexName("EmailIndex")
            .keyConditionExpression("email = :email")
            .expressionAttributeValues(Map.of(
                ":email", AttributeValue.builder().s(email).build()
            ))
            .build();
        
        QueryResponse response = dynamoDbClient.query(request);
        
        if (response.items().isEmpty()) {
            return Optional.empty();
        }

        return Optional.of(DynamoDbValueMapper.toJavaMap(response.items().get(0)));
    }

    public Optional<Map<String, Object>> addUser(String userId, String email, String password, String name, String phone, String role){
        String now = Instant.now().toString();
        Map<String, AttributeValue> item = new HashMap<>();
        item.put("userId", AttributeValue.builder().s(userId).build());
        item.put("createdAt", AttributeValue.builder().s(now).build());
        item.put("email", AttributeValue.builder().s(email).build());
        item.put("name", AttributeValue.builder().s(name).build());
        item.put("password", AttributeValue.builder().s(password).build());
        item.put("updatedAt", AttributeValue.builder().s(now).build());

        if (phone != null && !phone.isBlank()) {
            item.put("phone", AttributeValue.builder().s(phone).build());
        }

        if (role != null && !role.isBlank()) {
            item.put("role", AttributeValue.builder().s(role).build());
        }

        try {
            dynamoDbClient.putItem(
                PutItemRequest.builder().tableName(usersTableName)
                    .item(item)
                    .conditionExpression("attribute_not_exists(#userId) AND attribute_not_exists(#email)")
                    .expressionAttributeNames(Map.of("#userId", "userId", "#email", "email"))
                    .build()
            );
            return Optional.of(DynamoDbValueMapper.toJavaMap(item));
        } catch (ConditionalCheckFailedException exception) {
            return Optional.empty();
        }
    }

    public Optional<Map<String, Object>> updateEmail(String userId, String email) {
        String updatedTime = Instant.now().toString();
        try {
            UpdateItemResponse response = 
            dynamoDbClient.updateItem(
                UpdateItemRequest.builder().tableName(usersTableName)
                .key(Map.of(
                    "userId",
                    AttributeValue.builder().s(userId).build()
                ))
                .updateExpression(
                    "SET #email = :email, #updatedAt = :updatedAt"
                )
                .conditionExpression(
                    "attribute_exists(#userId) AND attribute_not_exists(#email)"
                )
                .expressionAttributeNames(Map.of(
                    "#userId", "userId",
                    "#email", "email",
                    "#updatedAt", "updatedAt"
                ))
                .expressionAttributeValues(Map.of(
                    ":email", AttributeValue.builder().s(email).build(),
                    ":updatedAt", AttributeValue.builder().s(updatedTime).build()
                ))
                .returnValues(ReturnValue.ALL_NEW).build()
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

    public Optional<Map<String, Object>> updatePassword(String userId, String password) {
        String updateTime = Instant.now().toString();
        try {
            UpdateItemResponse response = 
            dynamoDbClient.updateItem(
                UpdateItemRequest.builder().tableName(usersTableName)
                .key(Map.of(
                    "userId",
                    AttributeValue.builder().s(userId).build()
                ))
                .updateExpression(
                    "SET #password = :password, #updatedAt = :updatedAt"
                )
                .conditionExpression(
                    "attribute_exists(#userId)"
                )
                .expressionAttributeNames(Map.of(
                    "#userId", "userId",
                    "#password", "password",
                    "#updatedAt", "updatedAt"
                ))
                .expressionAttributeValues(Map.of(
                    ":password", AttributeValue.builder().s(password).build(),
                    ":updatedAt", AttributeValue.builder().s(updateTime).build()
                ))
                .returnValues(ReturnValue.ALL_NEW).build()
            );
        
            return Optional.of(DynamoDbValueMapper.toJavaMap(response.attributes()));

        } catch (ConditionalCheckFailedException exception) {
            return Optional.empty();
        }
    }

    // Add a findAll function?
}