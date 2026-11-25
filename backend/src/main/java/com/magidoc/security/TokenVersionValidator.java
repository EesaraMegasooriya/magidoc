package com.magidoc.security;

import com.magidoc.user.UserRepository;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;

import java.util.UUID;

/** Rejects tokens of deleted users and tokens issued before the user's sessions were revoked. */
public class TokenVersionValidator implements OAuth2TokenValidator<Jwt> {

    public static final String CLAIM = "tv";
    private static final OAuth2Error REVOKED = new OAuth2Error("invalid_token", "Session has expired or was revoked", null);

    private final UserRepository users;

    public TokenVersionValidator(UserRepository users) {
        this.users = users;
    }

    @Override
    public OAuth2TokenValidatorResult validate(Jwt jwt) {
        UUID userId;
        try {
            userId = UUID.fromString(jwt.getSubject());
        } catch (IllegalArgumentException | NullPointerException e) {
            return OAuth2TokenValidatorResult.failure(REVOKED);
        }
        Object claim = jwt.getClaims().get(CLAIM);
        if (!(claim instanceof Number version)) return OAuth2TokenValidatorResult.failure(REVOKED);
        return users.findById(userId)
                .filter(u -> u.getTokenVersion() == version.intValue())
                .map(u -> OAuth2TokenValidatorResult.success())
                .orElseGet(() -> OAuth2TokenValidatorResult.failure(REVOKED));
    }
}
