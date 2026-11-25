package com.magidoc.auth;

import com.magidoc.user.UserDto;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class AuthDtos {

    private AuthDtos() {
    }

    public record RegisterRequest(@NotBlank @Size(max = 120) String name,
                                  @NotBlank @Email @Size(max = 255) String email,
                                  @NotBlank @Size(min = 8, max = 100) String password) {
    }

    public record LoginRequest(@NotBlank @Email String email, @NotBlank String password) {
    }

    /**
     * Browsers authenticate with the HttpOnly session cookie set alongside this response;
     * {@code token} is provided for API clients that send {@code Authorization: Bearer}.
     */
    public record AuthResponse(String token, UserDto user) {
    }

    public record ResetPasswordRequest(@NotBlank @Email String email, @NotBlank @Size(max = 32) String recoveryCode,
                                       @NotBlank @Size(min = 8, max = 100) String newPassword) {
    }

    public record ResetPasswordResult(int recoveryCodesRemaining) {
    }
}
