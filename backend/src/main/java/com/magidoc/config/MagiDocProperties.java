package com.magidoc.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;
import java.util.List;

@ConfigurationProperties(prefix = "magidoc")
public record MagiDocProperties(Jwt jwt, Auth auth, Cors cors, Proxy proxy) {

    /** cookieSecure must be true whenever the app is served over HTTPS (always in production). */
    public record Auth(boolean cookieSecure) {
    }

    public record Jwt(String secret, Duration expiration) {
    }

    public record Cors(List<String> allowedOrigins) {
    }

    public record Proxy(Duration connectTimeout, Duration requestTimeout, long maxResponseBytes,
                        boolean blockPrivateNetworks) {
    }
}
