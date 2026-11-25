package com.magidoc.auth;

import com.magidoc.auth.AuthDtos.AuthResponse;
import com.magidoc.auth.AuthDtos.LoginRequest;
import com.magidoc.auth.AuthDtos.RegisterRequest;
import com.magidoc.auth.AuthDtos.ResetPasswordRequest;
import com.magidoc.auth.AuthDtos.ResetPasswordResult;
import com.magidoc.collection.SampleDataService;
import com.magidoc.common.ApiException;
import com.magidoc.common.AttemptLimiter;
import com.magidoc.common.AttemptLimiter.Policy;
import com.magidoc.security.TokenService;
import com.magidoc.user.User;
import com.magidoc.user.UserDto;
import com.magidoc.user.UserRepository;
import com.magidoc.workspace.Workspace;
import com.magidoc.workspace.WorkspaceService;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

@Service
@RequiredArgsConstructor
public class AuthService {

    private static final List<String> AVATAR_COLORS =
            List.of("#8b5cf6", "#ec4899", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#a855f7");

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final TokenService tokenService;
    private final WorkspaceService workspaceService;
    private final SampleDataService sampleDataService;
    private final RecoveryCodeService recoveryCodes;
    private final AttemptLimiter limiter;

    /** Real BCrypt hash compared against when an account doesn't exist, so timing doesn't reveal registered emails. */
    private String dummyHash;

    @PostConstruct
    void init() {
        dummyHash = passwordEncoder.encode(UUID.randomUUID().toString());
    }

    @Transactional
    public AuthResponse register(RegisterRequest req) {
        String email = normalizeEmail(req.email());
        if (users.existsByEmailIgnoreCase(email)) {
            throw ApiException.conflict("An account with this email already exists");
        }
        User user = new User();
        user.setEmail(email);
        user.setName(req.name().trim());
        user.setPasswordHash(passwordEncoder.encode(req.password()));
        user.setAvatarColor(AVATAR_COLORS.get(ThreadLocalRandom.current().nextInt(AVATAR_COLORS.size())));
        user = users.save(user);

        Workspace personal = workspaceService.createFor(user.getId(), "My Workspace",
                "Your personal space for APIs and experiments.");
        sampleDataService.seed(personal.getId(), user.getId());

        return new AuthResponse(tokenService.issue(user), UserDto.from(user));
    }

    /** Throttled per account and per client IP; failures don't reveal whether the email exists. */
    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest req, String clientIp) {
        String email = normalizeEmail(req.email());
        limiter.checkAllowed(Policy.LOGIN_IP, clientIp);
        limiter.checkAllowed(Policy.LOGIN_ACCOUNT, email);

        Optional<User> found = users.findByEmailIgnoreCase(email);
        boolean ok = passwordEncoder.matches(req.password(), found.map(User::getPasswordHash).orElse(dummyHash))
                && found.isPresent();
        if (!ok) {
            limiter.recordFailure(Policy.LOGIN_IP, clientIp);
            limiter.recordFailure(Policy.LOGIN_ACCOUNT, email);
            throw ApiException.unauthorized("Invalid email or password");
        }
        limiter.reset(Policy.LOGIN_ACCOUNT, email);
        return new AuthResponse(tokenService.issue(found.get()), UserDto.from(found.get()));
    }

    /** Resets a forgotten password with a one-time recovery code, then signs out every session. */
    @Transactional
    public ResetPasswordResult resetPassword(ResetPasswordRequest req, String clientIp) {
        String email = normalizeEmail(req.email());
        limiter.checkAllowed(Policy.LOGIN_IP, clientIp);
        limiter.checkAllowed(Policy.PASSWORD_RESET, email);

        Optional<User> found = users.findByEmailIgnoreCase(email);
        boolean ok = found.isPresent() && recoveryCodes.redeem(found.get().getId(), req.recoveryCode());
        if (!ok) {
            if (found.isEmpty()) passwordEncoder.matches(req.recoveryCode(), dummyHash); // equalize timing
            limiter.recordFailure(Policy.LOGIN_IP, clientIp);
            limiter.recordFailure(Policy.PASSWORD_RESET, email);
            throw ApiException.badRequest("Invalid email or recovery code");
        }
        limiter.reset(Policy.PASSWORD_RESET, email);
        limiter.reset(Policy.LOGIN_ACCOUNT, email);
        User user = found.get();
        user.setPasswordHash(passwordEncoder.encode(req.newPassword()));
        user.setTokenVersion(user.getTokenVersion() + 1);
        return new ResetPasswordResult(recoveryCodes.status(user.getId()).remaining());
    }

    private static String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
