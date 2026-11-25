package com.magidoc;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/** Cookie sessions, CSRF guard, session revocation, recovery codes and brute-force throttling. */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:magidoc-security-test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1"
})
@AutoConfigureMockMvc
class SecurityIntegrationTest {

    private static final String CLIENT = "X-MagiDoc-Client";

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper mapper;

    private static String email() {
        return "sec-" + UUID.randomUUID().toString().substring(0, 8) + "@example.com";
    }

    @Test
    void browserSessionUsesHttpOnlyCookieAndRequiresClientHeaderForWrites() throws Exception {
        MockHttpServletResponse reg = send(post("/api/auth/register").header(CLIENT, "web"),
                "{\"name\":\"Cookie\",\"email\":\"" + email() + "\",\"password\":\"password123\"}");
        assertThat(reg.getStatus()).isEqualTo(201);
        String setCookie = reg.getHeader("Set-Cookie");
        assertThat(setCookie).startsWith("magidoc_session=").contains("HttpOnly").contains("SameSite=Lax").contains("Path=/api");
        Cookie session = reg.getCookie("magidoc_session");
        assertThat(session).isNotNull();

        // Reads work with just the cookie
        assertThat(send(get("/api/workspaces").cookie(session), null).getStatus()).isEqualTo(200);
        // Writes without the client header are rejected (CSRF), with it they work
        assertThat(send(post("/api/workspaces").cookie(session), "{\"name\":\"X\"}").getStatus()).isEqualTo(403);
        assertThat(send(post("/api/workspaces").cookie(session).header(CLIENT, "web"), "{\"name\":\"X\"}").getStatus()).isEqualTo(201);
        // Login without the header is rejected too (login CSRF)
        assertThat(send(post("/api/auth/login"), "{\"email\":\"a@b.co\",\"password\":\"x\"}").getStatus()).isEqualTo(403);

        // A stale/invalid cookie never blocks signing in again
        String mail = email();
        send(post("/api/auth/register").header(CLIENT, "web"), "{\"name\":\"Stale\",\"email\":\"" + mail + "\",\"password\":\"password123\"}");
        MockHttpServletResponse login = send(post("/api/auth/login").header(CLIENT, "web").cookie(new Cookie("magidoc_session", "garbage")),
                "{\"email\":\"" + mail + "\",\"password\":\"password123\"}");
        assertThat(login.getStatus()).isEqualTo(200);
        assertThat(send(get("/api/workspaces").cookie(new Cookie("magidoc_session", "garbage")), null).getStatus()).isEqualTo(401);

        // Logout clears the cookie
        MockHttpServletResponse logout = send(post("/api/auth/logout").header(CLIENT, "web").cookie(session), null);
        assertThat(logout.getStatus()).isEqualTo(204);
        assertThat(logout.getHeader("Set-Cookie")).contains("Max-Age=0");
    }

    @Test
    void passwordChangeAndSignOutEverywhereRevokeSessions() throws Exception {
        String mail = email();
        String oldToken = json(send(post("/api/auth/register").header(CLIENT, "web"),
                "{\"name\":\"Rev\",\"email\":\"" + mail + "\",\"password\":\"password123\"}")).get("token").asText();
        String otherDevice = json(send(post("/api/auth/login").header(CLIENT, "web"),
                "{\"email\":\"" + mail + "\",\"password\":\"password123\"}")).get("token").asText();

        MockHttpServletResponse changed = send(put("/api/users/me/password").header("Authorization", "Bearer " + oldToken),
                "{\"currentPassword\":\"password123\",\"newPassword\":\"newpassword456\"}");
        assertThat(changed.getStatus()).isEqualTo(200);
        String fresh = json(changed).get("token").asText();
        assertThat(authedGet(oldToken)).isEqualTo(401);
        assertThat(authedGet(otherDevice)).isEqualTo(401);
        assertThat(authedGet(fresh)).isEqualTo(200);

        assertThat(send(post("/api/users/me/sessions/revoke").header("Authorization", "Bearer " + fresh), null).getStatus()).isEqualTo(204);
        assertThat(authedGet(fresh)).isEqualTo(401);
    }

    @Test
    void recoveryCodesResetAForgottenPasswordOnce() throws Exception {
        String mail = email();
        String token = json(send(post("/api/auth/register").header(CLIENT, "web"),
                "{\"name\":\"Rec\",\"email\":\"" + mail + "\",\"password\":\"password123\"}")).get("token").asText();
        assertThat(json(send(get("/api/users/me/recovery-codes").header("Authorization", "Bearer " + token), null))
                .get("remaining").asInt()).isZero();

        assertThat(send(post("/api/users/me/recovery-codes").header("Authorization", "Bearer " + token),
                "{\"currentPassword\":\"wrong-password\"}").getStatus()).isEqualTo(400);
        JsonNode codes = json(send(post("/api/users/me/recovery-codes").header("Authorization", "Bearer " + token),
                "{\"currentPassword\":\"password123\"}")).get("codes");
        assertThat(codes).hasSize(10);
        String code = codes.get(0).asText();
        assertThat(code).matches("[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}");

        String reset = "{\"email\":\"" + mail + "\",\"recoveryCode\":\"%s\",\"newPassword\":\"brandnew789\"}";
        assertThat(send(post("/api/auth/reset-password").header(CLIENT, "web"), reset.formatted("AAAAA-AAAAA")).getStatus()).isEqualTo(400);
        assertThat(send(post("/api/auth/reset-password").header(CLIENT, "web"),
                "{\"email\":\"nobody-" + mail + "\",\"recoveryCode\":\"" + code + "\",\"newPassword\":\"brandnew789\"}").getStatus()).isEqualTo(400);

        // Codes are case/format-insensitive; success revokes existing sessions
        MockHttpServletResponse ok = send(post("/api/auth/reset-password").header(CLIENT, "web"),
                reset.formatted(code.toLowerCase().replace("-", " ")));
        assertThat(ok.getStatus()).isEqualTo(200);
        assertThat(json(ok).get("recoveryCodesRemaining").asInt()).isEqualTo(9);
        assertThat(authedGet(token)).isEqualTo(401);
        assertThat(send(post("/api/auth/login").header(CLIENT, "web"),
                "{\"email\":\"" + mail + "\",\"password\":\"brandnew789\"}").getStatus()).isEqualTo(200);

        // The same code can't be used twice
        assertThat(send(post("/api/auth/reset-password").header(CLIENT, "web"), reset.formatted(code)).getStatus()).isEqualTo(400);
    }

    @Test
    void repeatedWrongPasswordsAreThrottled() throws Exception {
        String mail = email();
        send(post("/api/auth/register").header(CLIENT, "web"), "{\"name\":\"Brute\",\"email\":\"" + mail + "\",\"password\":\"password123\"}");
        String wrong = "{\"email\":\"" + mail + "\",\"password\":\"nope-nope\"}";
        for (int i = 0; i < 5; i++) {
            assertThat(send(post("/api/auth/login").header(CLIENT, "web"), wrong).getStatus()).isEqualTo(401);
        }
        // Even the correct password is refused while the account is throttled
        assertThat(send(post("/api/auth/login").header(CLIENT, "web"),
                "{\"email\":\"" + mail + "\",\"password\":\"password123\"}").getStatus()).isEqualTo(429);
    }

    private int authedGet(String token) throws Exception {
        return send(get("/api/workspaces").header("Authorization", "Bearer " + token), null).getStatus();
    }

    private MockHttpServletResponse send(MockHttpServletRequestBuilder builder, String body) throws Exception {
        if (body != null) builder.contentType(MediaType.APPLICATION_JSON).content(body);
        return mvc.perform(builder).andReturn().getResponse();
    }

    private JsonNode json(MockHttpServletResponse res) throws Exception {
        return mapper.readTree(res.getContentAsString());
    }
}
