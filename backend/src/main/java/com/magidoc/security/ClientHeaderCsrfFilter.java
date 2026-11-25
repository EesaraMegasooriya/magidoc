package com.magidoc.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.lang.NonNull;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Set;

/**
 * CSRF protection for cookie sessions: every state-changing /api request that doesn't carry an explicit
 * Authorization header must send {@value #HEADER}. Browsers can't add custom headers to cross-site requests
 * without a CORS preflight, which only allowed origins pass. (Also prevents login CSRF.)
 */
public class ClientHeaderCsrfFilter extends OncePerRequestFilter {

    public static final String HEADER = "X-MagiDoc-Client";
    private static final Set<String> SAFE_METHODS = Set.of("GET", "HEAD", "OPTIONS", "TRACE");

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request, @NonNull HttpServletResponse response,
                                    @NonNull FilterChain chain) throws ServletException, IOException {
        boolean unsafe = !SAFE_METHODS.contains(request.getMethod());
        boolean api = request.getRequestURI().startsWith("/api/");
        boolean explicitAuth = request.getHeader(HttpHeaders.AUTHORIZATION) != null;
        if (unsafe && api && !explicitAuth && request.getHeader(HEADER) == null) {
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
            response.getWriter().write("{\"status\":403,\"title\":\"Forbidden\",\"detail\":\"Missing " + HEADER + " header\"}");
            return;
        }
        chain.doFilter(request, response);
    }
}
