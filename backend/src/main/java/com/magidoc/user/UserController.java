package com.magidoc.user;

import com.magidoc.auth.AuthDtos.AuthResponse;
import com.magidoc.auth.RecoveryCodeService;
import com.magidoc.common.ApiException;
import com.magidoc.security.SecurityUtils;
import com.magidoc.security.SessionCookies;
import com.magidoc.security.TokenService;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/users/me")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final TokenService tokenService;
    private final SessionCookies cookies;
    private final RecoveryCodeService recoveryCodes;

    public record UpdateProfile(@NotBlank @Size(max = 120) String name,
                                @Pattern(regexp = "^#[0-9a-fA-F]{6}$", message = "must be a hex color") String avatarColor) {
    }

    public record ChangePassword(@NotBlank String currentPassword,
                                 @NotBlank @Size(min = 8, max = 100) String newPassword) {
    }

    public record ConfirmPassword(@NotBlank String currentPassword) {
    }

    public record RecoveryCodes(List<String> codes) {
    }

    @GetMapping
    public UserDto me() {
        return UserDto.from(current());
    }

    @PutMapping
    @Transactional
    public UserDto update(@Valid @RequestBody UpdateProfile req) {
        User u = current();
        u.setName(req.name().trim());
        if (req.avatarColor() != null) {
            u.setAvatarColor(req.avatarColor());
        }
        return UserDto.from(u);
    }

    /** Changing the password signs out every other session; this browser gets a fresh session. */
    @PutMapping("/password")
    @Transactional
    public AuthResponse changePassword(@Valid @RequestBody ChangePassword req, HttpServletResponse response) {
        User u = current();
        verifyPassword(u, req.currentPassword());
        u.setPasswordHash(passwordEncoder.encode(req.newPassword()));
        return reissue(u, response);
    }

    /** Revokes every session (all devices), including this one. */
    @PostMapping("/sessions/revoke")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void signOutEverywhere(HttpServletResponse response) {
        User u = current();
        u.setTokenVersion(u.getTokenVersion() + 1);
        cookies.clear(response);
    }

    @GetMapping("/recovery-codes")
    public RecoveryCodeService.Status recoveryCodeStatus() {
        return recoveryCodes.status(current().getId());
    }

    /** Generating codes is sensitive, so it requires the current password. Codes are shown only once. */
    @PostMapping("/recovery-codes")
    @Transactional
    public RecoveryCodes generateRecoveryCodes(@Valid @RequestBody ConfirmPassword req) {
        User u = current();
        verifyPassword(u, req.currentPassword());
        return new RecoveryCodes(recoveryCodes.regenerate(u.getId()));
    }

    private AuthResponse reissue(User u, HttpServletResponse response) {
        u.setTokenVersion(u.getTokenVersion() + 1);
        users.saveAndFlush(u);
        String token = tokenService.issue(u);
        cookies.set(response, token);
        return new AuthResponse(token, UserDto.from(u));
    }

    private void verifyPassword(User u, String password) {
        if (!passwordEncoder.matches(password, u.getPasswordHash())) {
            throw ApiException.badRequest("Current password is incorrect");
        }
    }

    private User current() {
        return users.findById(SecurityUtils.currentUserId())
                .orElseThrow(() -> ApiException.unauthorized("User no longer exists"));
    }
}
