package com.dishpatch.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.auth.credentials.AwsSessionCredentials;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;

@Configuration
public class DynamoDbConfig {

    @Bean
    public AwsCredentialsProvider awsCredentialsProvider(
            @Value("${aws.credentials.access-key-id:}")
            String accessKeyId,

            @Value("${aws.credentials.secret-access-key:}")
            String secretAccessKey,

            @Value("${aws.credentials.session-token:}")
            String sessionToken
    ) {
        boolean hasAccessKey =
                accessKeyId != null && !accessKeyId.isBlank();

        boolean hasSecretKey =
                secretAccessKey != null && !secretAccessKey.isBlank();

        boolean hasSessionToken =
                sessionToken != null && !sessionToken.isBlank();

        /*
         * Local development:
         * use the credentials loaded from .env.
         */
        if (hasAccessKey && hasSecretKey) {
            if (hasSessionToken) {
                return StaticCredentialsProvider.create(
                        AwsSessionCredentials.create(
                                accessKeyId,
                                secretAccessKey,
                                sessionToken
                        )
                );
            }

            return StaticCredentialsProvider.create(
                    AwsBasicCredentials.create(
                            accessKeyId,
                            secretAccessKey
                    )
            );
        }

        /*
         * Production:
         * use the EC2 IAM role through the AWS default
         * credentials provider chain.
         */
        return DefaultCredentialsProvider.create();
    }

    @Bean(destroyMethod = "close")
    public DynamoDbClient dynamoDbClient(
            @Value("${aws.region}") String region,
            AwsCredentialsProvider credentialsProvider
    ) {
        return DynamoDbClient.builder()
                .region(Region.of(region))
                .credentialsProvider(credentialsProvider)
                .build();
    }
}