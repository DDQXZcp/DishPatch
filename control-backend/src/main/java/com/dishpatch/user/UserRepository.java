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

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import com.dishpatch.order.DynamoDbValue.Mapper;

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
            return Optional.empty()
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

        return Optional.of(DynamoDbValueMapper.toJavaMap(response.items().get(0)))
    }

    // Add addUser()
    // Add updatePassword. Look into hashing

    public Optional<Map<String, Object>> updateEmail(String userId, String email) {
        try {
            UpdateItemResponse response = 
            dynamoDbClient.updateItem(
                UpdateItemRequest.builder().tableName(usersTableName)
                .key(Map.of(
                    "userId",
                    AttributeValue.builder().s(userId).build()
                ))
                .updateExpression(
                    "SET #email = :email"
                )
                .conditionExpression(
                    "attribute_exists(#userId)"
                )
                .expressionAttributeNames(Map.of(
                    "#userId",
                    "userId",
                    "#email",
                    "email"
                ))
                .expressionAttributeValues(Map.of(
                    ":email",
                    AttributeValue.builder().s(email).build()
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
}