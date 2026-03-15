package com.campusride;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class CampusRideApplication {

    public static void main(String[] args) {
        SpringApplication.run(CampusRideApplication.class, args);
    }
}