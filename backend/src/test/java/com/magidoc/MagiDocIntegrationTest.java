package com.magidoc;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:magidoc-test;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;DB_CLOSE_DELAY=-1"
})
@AutoConfigureMockMvc
class MagiDocIntegrationTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper mapper;

    @Test
    void endToEndCollaborationFlow() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String aliceToken = register("Alice", "alice-" + suffix + "@example.com");
        String bobEmail = "bob-" + suffix + "@example.com";

        // Personal workspace + sample collection are created on sign-up
        JsonNode workspaces = call(get("/api/workspaces"), aliceToken, null, 200);
        assertThat(workspaces).hasSize(1);
        assertThat(workspaces.get(0).get("role").asText()).isEqualTo("OWNER");

        // New team workspace
        JsonNode ws = call(post("/api/workspaces"), aliceToken, "{\"name\":\"Payments API\"}", 201);
        String wsId = ws.get("id").asText();

        // Global environment exists, add a variable environment
        JsonNode envs = call(get("/api/workspaces/" + wsId + "/environments"), aliceToken, null, 200);
        assertThat(envs).hasSize(1);
        assertThat(envs.get(0).get("global").asBoolean()).isTrue();
        call(post("/api/workspaces/" + wsId + "/environments"), aliceToken,
                "{\"name\":\"Dev\",\"variables\":[{\"key\":\"baseUrl\",\"value\":\"http://localhost\",\"enabled\":true}]}",
                201);

        // Collection, folder, request
        JsonNode col = call(post("/api/workspaces/" + wsId + "/collections"), aliceToken,
                "{\"name\":\"Payments\",\"description\":\"# Payments\"}", 201);
        String colId = col.get("id").asText();
        JsonNode folder = call(post("/api/collections/" + colId + "/folders"), aliceToken,
                "{\"name\":\"Charges\"}", 201);
        JsonNode req = call(post("/api/collections/" + colId + "/requests"), aliceToken,
                "{\"name\":\"Create charge\",\"method\":\"POST\",\"url\":\"{{baseUrl}}/charges\",\"folderId\":\""
                        + folder.get("id").asText() + "\",\"headers\":[{\"key\":\"Authorization\",\"value\":\"Bearer secret\",\"enabled\":true}]}",
                201);
        String reqId = req.get("id").asText();
        call(put("/api/requests/" + reqId), aliceToken, "{\"description\":\"Creates a charge\"}", 200);

        JsonNode detail = call(get("/api/collections/" + colId), aliceToken, null, 200);
        assertThat(detail.get("folders")).hasSize(1);
        assertThat(detail.get("requests").get(0).get("description").asText()).isEqualTo("Creates a charge");

        // Folder can't be moved into itself
        call(put("/api/folders/" + folder.get("id").asText() + "/move"), aliceToken,
                "{\"parentId\":\"" + folder.get("id").asText() + "\"}", 400);

        // Export -> import round trip
        JsonNode exported = call(get("/api/collections/" + colId + "/export"), aliceToken, null, 200);
        assertThat(exported.get("items").get(0).get("type").asText()).isEqualTo("folder");
        call(post("/api/workspaces/" + wsId + "/collections/import"), aliceToken, exported.toString(), 201);
        assertThat(call(get("/api/workspaces/" + wsId + "/collections"), aliceToken, null, 200)).hasSize(2);

        // Public share link masks secrets
        JsonNode share = call(post("/api/collections/" + colId + "/shares"), aliceToken, "{}", 201);
        JsonNode docs = call(get("/api/public/docs/" + share.get("token").asText()), null, null, 200);
        assertThat(docs.get("detail").get("requests").get(0).get("headers").get(0).get("value").asText())
                .isEqualTo("••••••");
        call(put("/api/shares/" + share.get("id").asText()), aliceToken, "{\"enabled\":false}", 200);
        call(get("/api/public/docs/" + share.get("token").asText()), null, null, 404);

        // People without an account can't be added by email — they use the join code instead
        call(post("/api/workspaces/" + wsId + "/members"), aliceToken,
                "{\"email\":\"" + bobEmail + "\",\"role\":\"VIEWER\"}", 400);
        assertThat(call(get("/api/workspaces/" + wsId + "/members"), aliceToken, null, 200)
                .get("joinCode").get("enabled").asBoolean()).isFalse();
        call(post("/api/workspaces/" + wsId + "/join-code"), aliceToken, "{\"role\":\"ADMIN\"}", 400);
        JsonNode code = call(post("/api/workspaces/" + wsId + "/join-code"), aliceToken, "{\"role\":\"VIEWER\"}", 200);
        String joinCode = code.get("code").asText();
        assertThat(joinCode).matches("[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}");

        String bobToken = register("Bob", bobEmail);
        call(post("/api/workspaces/join"), bobToken, "{\"code\":\"WRONG-CODE\"}", 404);
        // Codes are case/format-insensitive
        JsonNode joined = call(post("/api/workspaces/join"), bobToken,
                "{\"code\":\" " + joinCode.toLowerCase().replace("-", " ") + " \"}", 200);
        assertThat(joined.get("id").asText()).isEqualTo(wsId);
        assertThat(joined.get("role").asText()).isEqualTo("VIEWER");
        call(post("/api/workspaces/join"), bobToken, "{\"code\":\"" + joinCode + "\"}", 200); // idempotent

        // Non-admins never see the code
        assertThat(call(get("/api/workspaces/" + wsId + "/members"), bobToken, null, 200).get("joinCode").isNull())
                .isTrue();

        // Regenerating invalidates the old code; disabling turns joining off
        String newCode = call(post("/api/workspaces/" + wsId + "/join-code"), aliceToken, "{\"role\":\"EDITOR\"}", 200)
                .get("code").asText();
        assertThat(newCode).isNotEqualTo(joinCode);
        call(delete("/api/workspaces/" + wsId + "/join-code"), aliceToken, null, 204);

        // Viewer can read but not write
        call(get("/api/collections/" + colId), bobToken, null, 200);
        call(post("/api/collections/" + colId + "/requests"), bobToken, "{\"name\":\"Nope\"}", 403);

        // Team grants EDITOR access, which beats Bob's direct VIEWER role
        JsonNode team = call(post("/api/teams"), aliceToken, "{\"name\":\"Backend\"}", 201);
        String teamId = team.get("id").asText();
        call(post("/api/teams/" + teamId + "/members"), aliceToken,
                "{\"email\":\"" + bobEmail + "\",\"role\":\"MEMBER\"}", 201);
        call(post("/api/workspaces/" + wsId + "/teams"), aliceToken,
                "{\"teamId\":\"" + teamId + "\",\"role\":\"EDITOR\"}", 204);
        assertThat(call(get("/api/workspaces/" + wsId), bobToken, null, 200).get("role").asText())
                .isEqualTo("EDITOR");
        call(post("/api/collections/" + colId + "/requests"), bobToken, "{\"name\":\"Now allowed\"}", 201);

        // Bob can't delete the workspace; outsiders get 404
        call(delete("/api/workspaces/" + wsId), bobToken, null, 403);
        String eveToken = register("Eve", "eve-" + suffix + "@example.com");
        call(get("/api/workspaces/" + wsId), eveToken, null, 404);

        // Disabled codes no longer work; after 10 wrong guesses (1 + 9) further attempts are throttled
        call(post("/api/workspaces/join"), eveToken, "{\"code\":\"" + newCode + "\"}", 404);
        for (int i = 0; i < 9; i++) call(post("/api/workspaces/join"), eveToken, "{\"code\":\"AAAA-AAAA\"}", 404);
        call(post("/api/workspaces/join"), eveToken, "{\"code\":\"AAAA-AAAA\"}", 429);

        // Existing users can still be added directly by email
        JsonNode added = call(post("/api/workspaces/" + wsId + "/members"), aliceToken,
                "{\"email\":\"eve-" + suffix + "@example.com\",\"role\":\"VIEWER\"}", 200);
        assertThat(added.get("message").asText()).contains("Eve");

        // Execution validates URLs without leaking exceptions
        JsonNode exec = call(post("/api/workspaces/" + wsId + "/execute"), aliceToken,
                "{\"method\":\"GET\",\"url\":\"{{missing}}/x\"}", 200);
        assertThat(exec.get("error").asText()).contains("unresolved variable");

        // Activity is recorded
        assertThat(call(get("/api/workspaces/" + wsId + "/activity"), aliceToken, null, 200).size())
                .isGreaterThan(3);

        // Unauthenticated access is rejected
        mvc.perform(get("/api/workspaces")).andExpect(status().isUnauthorized());
    }

    @Test
    void mergeImportsAutoMergeAndPreserveIds() throws Exception {
        String token = register("Mia", "mia-" + UUID.randomUUID().toString().substring(0, 8) + "@example.com");
        String wsId = call(post("/api/workspaces"), token, "{\"name\":\"Merge\"}", 201).get("id").asText();

        // Two files describing overlapping APIs become ONE collection
        String fileA = """
                {"magidoc":"1.0","name":"Users API","variables":[{"key":"baseUrl","value":"https://a.test"}],
                 "items":[{"type":"folder","name":"Users","items":[
                   {"type":"request","name":"List users","method":"GET","url":"{{baseUrl}}/users"},
                   {"type":"request","name":"Get user","method":"GET","url":"{{baseUrl}}/users/1"}]}]}
                """;
        String fileB = """
                {"magidoc":"1.0","name":"Users v2","variables":[{"key":"baseUrl","value":"https://b.test"},{"key":"token","value":"x"}],
                 "items":[{"type":"folder","name":"users","items":[
                   {"type":"request","name":"List all users","method":"GET","url":"{{baseUrl}}/users/?page=1","description":"Paged"},
                   {"type":"request","name":"Create user","method":"POST","url":"{{baseUrl}}/users"}]},
                  {"type":"folder","name":"Orders","items":[{"type":"request","name":"Orders","method":"GET","url":"{{baseUrl}}/orders"}]}]}
                """;
        JsonNode merged = call(post("/api/workspaces/" + wsId + "/collections/import-merged"), token,
                "{\"name\":\"Combined\",\"collections\":[" + fileA + "," + fileB + "]}", 201);
        assertThat(merged.get("collection").get("name").asText()).isEqualTo("Combined");
        assertThat(merged.get("requestsAdded").asInt()).isEqualTo(4);   // 2 from A + Create user + Orders
        assertThat(merged.get("requestsUpdated").asInt()).isEqualTo(1); // List users matched by method + URL
        assertThat(merged.get("foldersAdded").asInt()).isEqualTo(2);    // Users + Orders ("users" matched)
        String colId = merged.get("collection").get("id").asText();
        JsonNode vars = merged.get("collection").get("variables");
        assertThat(vars).hasSize(2);
        assertThat(vars.get(0).get("value").asText()).isEqualTo("https://a.test"); // existing value kept

        JsonNode detail = call(get("/api/collections/" + colId), token, null, 200);
        assertThat(detail.get("folders")).hasSize(2);
        assertThat(detail.get("requests")).hasSize(4);
        JsonNode listUsers = null;
        for (JsonNode r : detail.get("requests")) if (r.get("name").asText().equals("List all users")) listUsers = r;
        assertThat(listUsers).isNotNull();
        assertThat(listUsers.get("description").asText()).isEqualTo("Paged");
        String listUsersId = listUsers.get("id").asText();

        // Merging an update into the existing collection keeps request ids
        JsonNode update = call(post("/api/collections/" + colId + "/merge"), token, """
                {"collections":[{"magidoc":"1.0","name":"ignored","items":[
                  {"type":"folder","name":"Users","items":[
                    {"type":"request","name":"List users","method":"GET","url":"{{baseUrl}}/users","description":"v3"},
                    {"type":"request","name":"Delete user","method":"DELETE","url":"{{baseUrl}}/users/1"}]}]}]}
                """, 200);
        assertThat(update.get("requestsUpdated").asInt()).isEqualTo(1);
        assertThat(update.get("requestsAdded").asInt()).isEqualTo(1);
        assertThat(update.get("foldersAdded").asInt()).isZero();
        assertThat(call(get("/api/requests/" + listUsersId), token, null, 200).get("description").asText())
                .isEqualTo("v3");
        assertThat(call(get("/api/collections/" + colId), token, null, 200).get("requests")).hasSize(5);
        call(post("/api/collections/" + colId + "/merge"), token, "{\"collections\":[]}", 400);
    }

    @Test
    void organizeFolderPathsRestructuresAnExistingCollectionInPlace() throws Exception {
        String token = register("Olga", "olga-" + UUID.randomUUID().toString().substring(0, 8) + "@example.com");
        String wsId = call(post("/api/workspaces"), token, "{\"name\":\"CMS\"}", 201).get("id").asText();
        // Shaped like a collection imported before folder paths were understood
        String cms = """
                {"magidoc":"1.0","name":"CMS V2 Documentation","items":[
                  {"type":"folder","name":"External User","items":[
                     {"type":"folder","name":"Chat","items":[{"type":"request","name":"List chats","method":"GET","url":"{{baseUrl}}/chats"}]}]},
                  {"type":"folder","name":"Internal User","items":[]},
                  {"type":"folder","name":"External User/Quiz","items":[
                     {"type":"request","name":"Get quiz","method":"GET","url":"{{baseUrl}}/quiz"}]},
                  {"type":"folder","name":"external user/Chat","items":[
                     {"type":"request","name":"Send message","method":"POST","url":"{{baseUrl}}/chats"}]},
                  {"type":"folder","name":"External User/Session/All Sessions","items":[
                     {"type":"request","name":"All","method":"GET","url":"{{baseUrl}}/sessions"}]},
                  {"type":"folder","name":"External User/Session/Physical","items":[
                     {"type":"request","name":"Physical","method":"GET","url":"{{baseUrl}}/sessions/physical"}]},
                  {"type":"folder","name":"Internal User/Conferences","items":[
                     {"type":"request","name":"Conferences/Create","method":"POST","url":"{{baseUrl}}/conferences"}]},
                  {"type":"folder","name":"GET /legacy","items":[]},
                  {"type":"request","name":"Internal User/Ping","method":"GET","url":"{{baseUrl}}/ping"}
                ]}
                """;
        String colId = call(post("/api/workspaces/" + wsId + "/collections/import"), token, cms, 201).get("id").asText();
        JsonNode before = call(get("/api/collections/" + colId), token, null, 200);
        String quizRequestId = idOf(before.get("requests"), "Get quiz");
        assertThat(before.get("requests")).hasSize(7);

        JsonNode result = call(post("/api/collections/" + colId + "/organize-folder-paths"), token, null, 200);
        assertThat(result.get("foldersMerged").asInt()).isEqualTo(1);   // "external user/Chat" → existing Chat
        assertThat(result.get("foldersCreated").asInt()).isEqualTo(2);  // Session + Conferences/ (for the request)
        assertThat(result.get("requestsMoved").asInt()).isEqualTo(2);   // Internal User/Ping, Conferences/Create

        JsonNode after = call(get("/api/collections/" + colId), token, null, 200);
        assertThat(tree(after)).isEqualTo(
                "External User[Chat[List chats, Send message], Quiz[Get quiz], Session[All Sessions[All], Physical[Physical]]], "
                        + "Internal User[Conferences[Conferences[Create]], Ping], GET /legacy[]");
        assertThat(after.get("requests")).hasSize(7);                    // nothing lost
        assertThat(idOf(after.get("requests"), "Get quiz")).isEqualTo(quizRequestId); // ids preserved

        // Running again changes nothing
        JsonNode again = call(post("/api/collections/" + colId + "/organize-folder-paths"), token, null, 200);
        assertThat(again.get("foldersMoved").asInt() + again.get("foldersMerged").asInt()
                + again.get("foldersCreated").asInt() + again.get("requestsMoved").asInt()).isZero();
    }

    private static String idOf(JsonNode requests, String name) {
        for (JsonNode r : requests) if (r.get("name").asText().equals(name)) return r.get("id").asText();
        throw new AssertionError("no request " + name);
    }

    /** Folder tree as "Folder[child, child]", folders by sort order then requests — like the sidebar. */
    private static String tree(JsonNode detail) {
        return children(detail, null);
    }

    private static String children(JsonNode detail, String parentId) {
        java.util.List<JsonNode> fs = new java.util.ArrayList<>();
        detail.get("folders").forEach(f -> {
            String p = f.get("parentId").isNull() ? null : f.get("parentId").asText();
            if (java.util.Objects.equals(p, parentId)) fs.add(f);
        });
        fs.sort(java.util.Comparator.comparingInt((JsonNode f) -> f.get("sortOrder").asInt()));
        java.util.List<String> parts = new java.util.ArrayList<>();
        for (JsonNode f : fs) parts.add(f.get("name").asText() + "[" + children(detail, f.get("id").asText()) + "]");
        detail.get("requests").forEach(r -> {
            String p = r.get("folderId").isNull() ? null : r.get("folderId").asText();
            if (java.util.Objects.equals(p, parentId)) parts.add(r.get("name").asText());
        });
        return String.join(", ", parts);
    }

    @Test
    void websocketConnectionsAreSavedPerWorkspace() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String owner = register("Wes", "wes-" + suffix + "@example.com");
        String wsId = call(post("/api/workspaces"), owner, "{\"name\":\"Realtime\"}", 201).get("id").asText();

        JsonNode created = call(post("/api/workspaces/" + wsId + "/websockets"), owner,
                "{\"name\":\"Echo\",\"url\":\"wss://echo.websocket.org\"}", 201);
        String id = created.get("id").asText();
        JsonNode updated = call(put("/api/websockets/" + id), owner,
                "{\"protocols\":[\"json\"],\"messages\":[{\"id\":\"m1\",\"name\":\"Ping\",\"body\":\"{\\\"type\\\":\\\"ping\\\"}\",\"format\":\"json\"}]}",
                200);
        assertThat(updated.get("protocols").get(0).asText()).isEqualTo("json");
        assertThat(updated.get("messages").get(0).get("name").asText()).isEqualTo("Ping");
        call(put("/api/websockets/" + id), owner, "{\"protocols\":[\"\"]}", 400);
        assertThat(call(get("/api/workspaces/" + wsId + "/websockets"), owner, null, 200)).hasSize(1);
        call(post("/api/websockets/" + id + "/duplicate"), owner, null, 201);

        // Viewers can read but not change saved connections; outsiders see nothing
        String code = call(post("/api/workspaces/" + wsId + "/join-code"), owner, "{\"role\":\"VIEWER\"}", 200)
                .get("code").asText();
        String viewer = register("Val", "val-" + suffix + "@example.com");
        call(post("/api/workspaces/join"), viewer, "{\"code\":\"" + code + "\"}", 200);
        assertThat(call(get("/api/workspaces/" + wsId + "/websockets"), viewer, null, 200)).hasSize(2);
        call(post("/api/workspaces/" + wsId + "/websockets"), viewer, "{\"name\":\"Nope\"}", 403);
        call(delete("/api/websockets/" + id), viewer, null, 403);
        String outsider = register("Oz", "oz-" + suffix + "@example.com");
        call(get("/api/workspaces/" + wsId + "/websockets"), outsider, null, 404);
        call(delete("/api/websockets/" + id), owner, null, 204);
    }

    @Test
    void textSpaceSharesNotesAndCodeWithConflictProtection() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String owner = register("Tess", "tess-" + suffix + "@example.com");
        String wsId = call(post("/api/workspaces"), owner, "{\"name\":\"Shared texts\"}", 201).get("id").asText();

        JsonNode note = call(post("/api/workspaces/" + wsId + "/snippets"), owner,
                "{\"title\":\"Deploy steps\",\"kind\":\"NOTE\",\"content\":\"# Deploy\\nRun 100% of tests\"}", 201);
        String noteId = note.get("id").asText();
        assertThat(note.get("language").isNull()).isTrue();
        assertThat(note.get("canDelete").asBoolean()).isTrue();
        JsonNode code = call(post("/api/workspaces/" + wsId + "/snippets"), owner,
                "{\"title\":\"Auth header\",\"kind\":\"CODE\",\"content\":\"Authorization: Bearer x\"}", 201);
        assertThat(code.get("language").asText()).isEqualTo("plaintext");
        call(post("/api/workspaces/" + wsId + "/snippets"), owner,
                "{\"title\":\"Bad\",\"kind\":\"CODE\",\"language\":\"Not A Lang!\"}", 400);

        // Search: matches title or content; % is treated literally
        assertThat(call(get("/api/workspaces/" + wsId + "/snippets").param("q", "BEARER"), owner, null, 200)).hasSize(1);
        assertThat(call(get("/api/workspaces/" + wsId + "/snippets").param("q", "100%"), owner, null, 200)).hasSize(1);
        assertThat(call(get("/api/workspaces/" + wsId + "/snippets").param("q", "%%_"), owner, null, 200)).isEmpty();
        assertThat(call(get("/api/workspaces/" + wsId + "/snippets"), owner, null, 200)).hasSize(2);

        // Editing requires the version you started from; stale versions are rejected
        long v0 = note.get("version").asLong();
        JsonNode edited = call(put("/api/snippets/" + noteId), owner,
                "{\"content\":\"v1\",\"version\":" + v0 + "}", 200);
        long v1 = edited.get("version").asLong();
        assertThat(v1).isGreaterThan(v0);
        call(put("/api/snippets/" + noteId), owner, "{\"content\":\"stale\",\"version\":" + v0 + "}", 409);

        // Pinning never invalidates someone's in-progress edit
        JsonNode pinned = call(put("/api/snippets/" + noteId + "/pin"), owner, "{\"pinned\":true}", 200);
        assertThat(pinned.get("pinned").asBoolean()).isTrue();
        assertThat(pinned.get("version").asLong()).isEqualTo(v1);
        call(put("/api/snippets/" + noteId), owner, "{\"content\":\"v2\",\"version\":" + v1 + "}", 200);
        assertThat(call(get("/api/workspaces/" + wsId + "/snippets"), owner, null, 200).get(0).get("id").asText())
                .isEqualTo(noteId); // pinned first

        // Editors can edit others' texts but only the author/admin can delete; viewers read only
        String editorCode = call(post("/api/workspaces/" + wsId + "/join-code"), owner, "{\"role\":\"EDITOR\"}", 200).get("code").asText();
        String editor = register("Ed", "ed-" + suffix + "@example.com");
        call(post("/api/workspaces/join"), editor, "{\"code\":\"" + editorCode + "\"}", 200);
        JsonNode asEditor = call(get("/api/snippets/" + noteId), editor, null, 200);
        assertThat(asEditor.get("canDelete").asBoolean()).isFalse();
        assertThat(asEditor.get("createdBy").get("name").asText()).isEqualTo("Tess");
        JsonNode editorSave = call(put("/api/snippets/" + noteId), editor,
                "{\"content\":\"edited by Ed\",\"version\":" + asEditor.get("version").asLong() + "}", 200);
        assertThat(editorSave.get("updatedBy").get("name").asText()).isEqualTo("Ed");
        call(delete("/api/snippets/" + noteId), editor, null, 403);

        String viewerCode = call(post("/api/workspaces/" + wsId + "/join-code"), owner, "{\"role\":\"VIEWER\"}", 200).get("code").asText();
        String viewer = register("Vi", "vi-" + suffix + "@example.com");
        call(post("/api/workspaces/join"), viewer, "{\"code\":\"" + viewerCode + "\"}", 200);
        assertThat(call(get("/api/snippets/" + noteId), viewer, null, 200).get("content").asText()).isEqualTo("edited by Ed");
        call(post("/api/workspaces/" + wsId + "/snippets"), viewer, "{\"title\":\"x\",\"kind\":\"NOTE\"}", 403);

        String outsider = register("Out", "out-" + suffix + "@example.com");
        call(get("/api/snippets/" + noteId), outsider, null, 404);

        call(delete("/api/snippets/" + noteId), owner, null, 204);
        call(get("/api/snippets/" + noteId), owner, null, 404);
    }

    @Test
    void registrationValidatesInput() throws Exception {
        call(post("/api/auth/register"), null, "{\"name\":\"\",\"email\":\"bad\",\"password\":\"123\"}", 400);
    }

    private String register(String name, String email) throws Exception {
        JsonNode res = call(post("/api/auth/register"), null,
                "{\"name\":\"" + name + "\",\"email\":\"" + email + "\",\"password\":\"password123\"}", 201);
        return res.get("token").asText();
    }

    private JsonNode call(MockHttpServletRequestBuilder builder, String token, String body, int expectedStatus)
            throws Exception {
        builder.header("X-MagiDoc-Client", "test"); // the web app sends this on every request (CSRF guard)
        if (token != null) builder.header("Authorization", "Bearer " + token);
        if (body != null) builder.contentType(MediaType.APPLICATION_JSON).content(body);
        String response = mvc.perform(builder).andExpect(status().is(expectedStatus))
                .andReturn().getResponse().getContentAsString();
        return response.isBlank() ? mapper.createObjectNode() : mapper.readTree(response);
    }
}
