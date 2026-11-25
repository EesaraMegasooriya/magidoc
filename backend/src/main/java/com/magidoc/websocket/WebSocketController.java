package com.magidoc.websocket;

import com.fasterxml.jackson.databind.JsonNode;
import com.magidoc.activity.ActivityService;
import com.magidoc.common.ApiException;
import com.magidoc.common.JsonSupport;
import com.magidoc.security.SecurityUtils;
import com.magidoc.workspace.WorkspaceAccessService;
import com.magidoc.workspace.WorkspaceRole;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class WebSocketController {

    private static final String TARGET = "websocket";
    private static final int MAX_MESSAGES = 200;

    private final WebSocketRequestRepository repo;
    private final WorkspaceAccessService access;
    private final JsonSupport json;
    private final ActivityService activity;

    public record WebSocketDto(UUID id, UUID workspaceId, String name, String url, JsonNode protocols,
                               JsonNode messages, Instant updatedAt) {
    }

    public record CreateWebSocket(@NotBlank @Size(max = 200) String name, @Size(max = 4000) String url) {
    }

    public record UpdateWebSocket(@Size(min = 1, max = 200) String name, @Size(max = 4000) String url,
                                  JsonNode protocols, JsonNode messages) {
    }

    @GetMapping("/workspaces/{workspaceId}/websockets")
    @Transactional(readOnly = true)
    public List<WebSocketDto> list(@PathVariable UUID workspaceId) {
        access.require(workspaceId, WorkspaceRole.VIEWER);
        return repo.findByWorkspaceIdOrderByNameAsc(workspaceId).stream().map(this::toDto).toList();
    }

    @PostMapping("/workspaces/{workspaceId}/websockets")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public WebSocketDto create(@PathVariable UUID workspaceId, @Valid @RequestBody CreateWebSocket req) {
        access.require(workspaceId, WorkspaceRole.EDITOR);
        WebSocketRequest w = new WebSocketRequest();
        w.setWorkspaceId(workspaceId);
        w.setName(req.name().trim());
        w.setUrl(req.url() == null ? "" : req.url().trim());
        w.setProtocols("[]");
        w.setMessages("[]");
        w.setCreatedBy(SecurityUtils.currentUserId());
        w = repo.saveAndFlush(w);
        activity.log(workspaceId, SecurityUtils.currentUserId(), "created", TARGET, w.getName());
        return toDto(w);
    }

    @PutMapping("/websockets/{id}")
    @Transactional
    public WebSocketDto update(@PathVariable UUID id, @Valid @RequestBody UpdateWebSocket req) {
        WebSocketRequest w = load(id);
        access.require(w.getWorkspaceId(), WorkspaceRole.EDITOR);
        if (req.name() != null) w.setName(req.name().trim());
        if (req.url() != null) w.setUrl(req.url().trim());
        if (req.protocols() != null) w.setProtocols(json.write(validProtocols(req.protocols())));
        if (req.messages() != null) w.setMessages(json.write(validMessages(req.messages())));
        w = repo.saveAndFlush(w);
        activity.log(w.getWorkspaceId(), SecurityUtils.currentUserId(), "updated", TARGET, w.getName());
        return toDto(w);
    }

    @PostMapping("/websockets/{id}/duplicate")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public WebSocketDto duplicate(@PathVariable UUID id) {
        WebSocketRequest src = load(id);
        access.require(src.getWorkspaceId(), WorkspaceRole.EDITOR);
        WebSocketRequest w = new WebSocketRequest();
        w.setWorkspaceId(src.getWorkspaceId());
        w.setName((src.getName() + " Copy").length() > 200 ? src.getName() : src.getName() + " Copy");
        w.setUrl(src.getUrl());
        w.setProtocols(src.getProtocols());
        w.setMessages(src.getMessages());
        w.setCreatedBy(SecurityUtils.currentUserId());
        return toDto(repo.saveAndFlush(w));
    }

    @DeleteMapping("/websockets/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void delete(@PathVariable UUID id) {
        WebSocketRequest w = load(id);
        access.require(w.getWorkspaceId(), WorkspaceRole.EDITOR);
        repo.delete(w);
        activity.log(w.getWorkspaceId(), SecurityUtils.currentUserId(), "deleted", TARGET, w.getName());
    }

    private WebSocketRequest load(UUID id) {
        return repo.findById(id).orElseThrow(() -> ApiException.notFound("WebSocket"));
    }

    private static JsonNode validProtocols(JsonNode n) {
        if (!n.isArray()) throw ApiException.badRequest("protocols must be an array of strings");
        for (JsonNode p : n) {
            if (!p.isTextual() || p.asText().isBlank() || p.asText().length() > 100) {
                throw ApiException.badRequest("Each subprotocol must be a non-empty string");
            }
        }
        return n;
    }

    private static JsonNode validMessages(JsonNode n) {
        if (!n.isArray()) throw ApiException.badRequest("messages must be an array");
        if (n.size() > MAX_MESSAGES) throw ApiException.badRequest("At most " + MAX_MESSAGES + " saved messages");
        for (JsonNode m : n) {
            if (!m.isObject()) throw ApiException.badRequest("Each saved message must be an object");
        }
        return n;
    }

    private WebSocketDto toDto(WebSocketRequest w) {
        return new WebSocketDto(w.getId(), w.getWorkspaceId(), w.getName(), w.getUrl(), json.readArray(w.getProtocols()),
                json.readArray(w.getMessages()), w.getUpdatedAt());
    }
}
