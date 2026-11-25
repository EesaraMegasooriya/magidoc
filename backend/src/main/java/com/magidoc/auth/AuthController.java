package com.magidoc.auth;

import com.magidoc.auth.AuthDtos.AuthResponse;
import com.magidoc.auth.AuthDtos.LoginRequest;
import com.magidoc.auth.AuthDtos.RegisterRequest;
import com.magidoc.auth.AuthDtos.ResetPasswordRequest;
import com.magidoc.auth.AuthDtos.ResetPasswordResult;
import com.magidoc.security.SessionCookies;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final SessionCookies cookies;

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthResponse register(@Valid @RequestBody RegisterRequest req, HttpServletResponse response) {
        AuthResponse res = authService.register(req);
        cookies.set(response, res.token());
        return res;
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest req, HttpServletRequest request,
                              HttpServletResponse response) {
        AuthResponse res = authService.login(req, request.getRemoteAddr());
        cookies.set(response, res.token());
        return res;
    }

    /** Ends this browser's session. Use "sign out everywhere" to revoke all sessions. */
    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(HttpServletResponse response) {
        cookies.clear(response);
    }

    @PostMapping("/reset-password")
    public ResetPasswordResult resetPassword(@Valid @RequestBody ResetPasswordRequest req, HttpServletRequest request,
                                             HttpServletResponse response) {
        ResetPasswordResult result = authService.resetPassword(req, request.getRemoteAddr());
        cookies.clear(response);
        return result;
    }
}
