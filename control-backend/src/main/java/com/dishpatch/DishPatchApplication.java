package com.dishpatch;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class DishPatchApplication {

    public static void main(String[] args) {
        SpringApplication.run(DishPatchApplication.class, args);
    }
}