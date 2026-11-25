package com.magidoc.common;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Sliding-window limiter for failed attempts (sign-in, password reset, join codes).
 * In-memory per instance; back it with a shared store (e.g. Redis) when running several instances.
 */
@Component
public class AttemptLimiter {

    public enum Policy {
        /** Wrong passwords for one account. */
        LOGIN_ACCOUNT(5, Duration.ofMinutes(15)),
        /** Wrong passwords from one IP across all accounts (credential stuffing). */
        LOGIN_IP(30, Duration.ofMinutes(15)),
        /** Wrong recovery codes for one account. */
        PASSWORD_RESET(5, Duration.ofMinutes(15)),
        /** Wrong workspace join codes per user. */
        JOIN_CODE(10, Duration.ofMinutes(15));

        final int maxFailures;
        final Duration window;

        Policy(int maxFailures, Duration window) {
            this.maxFailures = maxFailures;
            this.window = window;
        }
    }

    private static final int CLEANUP_THRESHOLD = 10_000;

    private final Map<String, Deque<Instant>> failures = new ConcurrentHashMap<>();

    /** Throws 429 when the key has used up its failures for the current window. */
    public void checkAllowed(Policy policy, String key) {
        Deque<Instant> recent = failures.get(bucket(policy, key));
        if (recent == null) return;
        synchronized (recent) {
            prune(recent, policy.window);
            if (recent.size() >= policy.maxFailures) {
                throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "Too many attempts. Please wait a few minutes and try again.");
            }
        }
    }

    public void recordFailure(Policy policy, String key) {
        if (failures.size() > CLEANUP_THRESHOLD) cleanup();
        Deque<Instant> recent = failures.computeIfAbsent(bucket(policy, key), k -> new ArrayDeque<>());
        synchronized (recent) {
            prune(recent, policy.window);
            recent.addLast(Instant.now());
        }
    }

    public void reset(Policy policy, String key) {
        failures.remove(bucket(policy, key));
    }

    private static String bucket(Policy policy, String key) {
        return policy.name() + ":" + key;
    }

    private static void prune(Deque<Instant> recent, Duration window) {
        Instant cutoff = Instant.now().minus(window);
        while (!recent.isEmpty() && recent.peekFirst().isBefore(cutoff)) recent.pollFirst();
    }

    /** Drops expired buckets so memory can't grow without bound. */
    private void cleanup() {
        Instant cutoff = Instant.now().minus(Duration.ofHours(1));
        failures.entrySet().removeIf(e -> {
            synchronized (e.getValue()) {
                return e.getValue().isEmpty() || e.getValue().peekLast().isBefore(cutoff);
            }
        });
    }
}
