package com.magidoc.environment;

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
public class EnvironmentController {

    private final EnvironmentRepository environments;
    private final WorkspaceAccessService access;
    private final JsonSupport json;
    private final ActivityService activity;

    public record EnvironmentDto(UUID id, UUID workspaceId, String name, JsonNode variables, boolean global,
                                 Instant updatedAt) {
    }

    public record CreateEnvironment(@NotBlank @Size(max = 120) String name, JsonNode variables) {
    }

    public record UpdateEnvironment(@Size(min = 1, max = 120) String name, JsonNode variables) {
    }

    @GetMapping("/workspaces/{workspaceId}/environments")
    @Transactional(readOnly = true)
    public List<EnvironmentDto> list(@PathVariable UUID workspaceId) {
        access.require(workspaceId, WorkspaceRole.VIEWER);
        return environments.findByWorkspaceIdOrderByGlobalDescNameAsc(workspaceId).stream().map(this::toDto).toList();
    }

    @PostMapping("/workspaces/{workspaceId}/environments")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public EnvironmentDto create(@PathVariable UUID workspaceId, @Valid @RequestBody CreateEnvironment req) {
        access.require(workspaceId, WorkspaceRole.EDITOR);
        Environment e = new Environment();
        e.setWorkspaceId(workspaceId);
        e.setName(req.name().trim());
        e.setVariables(req.variables() == null ? "[]" : json.write(requireArray(req.variables())));
        e.setGlobal(false);
        e = environments.saveAndFlush(e);
        activity.log(workspaceId, SecurityUtils.currentUserId(), "created", "environment", e.getName());
        return toDto(e);
    }

    @PutMapping("/environments/{id}")
    @Transactional
    public EnvironmentDto update(@PathVariable UUID id, @Valid @RequestBody UpdateEnvironment req) {
        Environment e = load(id);
        access.require(e.getWorkspaceId(), WorkspaceRole.EDITOR);
        if (req.name() != null && !e.isGlobal()) e.setName(req.name().trim());
        if (req.variables() != null) e.setVariables(json.write(requireArray(req.variables())));
        e = environments.saveAndFlush(e);
        activity.log(e.getWorkspaceId(), SecurityUtils.currentUserId(), "updated", "environment", e.getName());
        return toDto(e);
    }

    @PostMapping("/environments/{id}/duplicate")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public EnvironmentDto duplicate(@PathVariable UUID id) {
        Environment src = load(id);
        access.require(src.getWorkspaceId(), WorkspaceRole.EDITOR);
        Environment e = new Environment();
        e.setWorkspaceId(src.getWorkspaceId());
        e.setName(src.getName() + " Copy");
        e.setVariables(src.getVariables());
        e.setGlobal(false);
        return toDto(environments.saveAndFlush(e));
    }

    @DeleteMapping("/environments/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void delete(@PathVariable UUID id) {
        Environment e = load(id);
        access.require(e.getWorkspaceId(), WorkspaceRole.EDITOR);
        if (e.isGlobal()) throw ApiException.badRequest("The global environment can't be deleted");
        environments.delete(e);
        activity.log(e.getWorkspaceId(), SecurityUtils.currentUserId(), "deleted", "environment", e.getName());
    }

    private Environment load(UUID id) {
        return environments.findById(id).orElseThrow(() -> ApiException.notFound("Environment"));
    }

    private static JsonNode requireArray(JsonNode n) {
        if (!n.isArray()) throw ApiException.badRequest("variables must be an array");
        return n;
    }

    private EnvironmentDto toDto(Environment e) {
        return new EnvironmentDto(e.getId(), e.getWorkspaceId(), e.getName(), json.readArray(e.getVariables()),
                e.isGlobal(), e.getUpdatedAt());
    }
}
