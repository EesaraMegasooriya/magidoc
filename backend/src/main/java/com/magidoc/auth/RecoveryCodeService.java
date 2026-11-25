package com.magidoc.auth;

import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/** Issues and redeems one-time recovery codes (like 2FA backup codes) for password resets without email. */
@Service
@RequiredArgsConstructor
public class RecoveryCodeService {

    public static final int CODE_COUNT = 10;
    private static final char[] ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789".toCharArray();
    private static final int CODE_LENGTH = 10;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final RecoveryCodeRepository codes;
    private final PasswordEncoder passwordEncoder;

    public record Status(int remaining, int total, Instant generatedAt) {
    }

    /** Replaces any existing codes. The plain codes are returned exactly once. */
    @Transactional
    public List<String> regenerate(UUID userId) {
        codes.deleteAllForUser(userId);
        List<String> plain = new ArrayList<>(CODE_COUNT);
        for (int i = 0; i < CODE_COUNT; i++) {
            String code = randomCode();
            RecoveryCode rc = new RecoveryCode();
            rc.setUserId(userId);
            rc.setCodeHash(passwordEncoder.encode(code));
            codes.save(rc);
            plain.add(format(code));
        }
        return plain;
    }

    @Transactional(readOnly = true)
    public Status status(UUID userId) {
        List<RecoveryCode> all = codes.findByUserIdOrderByCreatedAtDesc(userId);
        int remaining = (int) all.stream().filter(c -> c.getUsedAt() == null).count();
        return new Status(remaining, all.size(), all.isEmpty() ? null : all.get(0).getCreatedAt());
    }

    /** Marks a matching unused code as used. Returns false when no unused code matches. */
    @Transactional
    public boolean redeem(UUID userId, String rawCode) {
        String code = normalize(rawCode);
        if (code.length() != CODE_LENGTH) return false;
        for (RecoveryCode rc : codes.findByUserIdAndUsedAtIsNull(userId)) {
            if (passwordEncoder.matches(code, rc.getCodeHash())) {
                rc.setUsedAt(Instant.now());
                return true;
            }
        }
        return false;
    }

    /** Accepts "abcde-fghjk", "ABCDE FGHJK", etc. */
    static String normalize(String raw) {
        return raw == null ? "" : raw.toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]", "");
    }

    private static String format(String code) {
        return code.substring(0, 5) + "-" + code.substring(5);
    }

    private static String randomCode() {
        char[] out = new char[CODE_LENGTH];
        for (int i = 0; i < CODE_LENGTH; i++) out[i] = ALPHABET[RANDOM.nextInt(ALPHABET.length)];
        return new String(out);
    }
}
