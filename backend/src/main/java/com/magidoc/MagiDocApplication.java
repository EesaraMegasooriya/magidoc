package com.magidoc;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class MagiDocApplication {
    public static void main(String[] args) {
        SpringApplication.run(MagiDocApplication.class, args);
    }
}
