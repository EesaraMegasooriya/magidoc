package com.magidoc.workspace;

import com.magidoc.activity.ActivityService;
import com.magidoc.collection.ApiCollectionRepository;
import com.magidoc.common.ApiException;
import com.magidoc.environment.Environment;
import com.magidoc.environment.EnvironmentRepository;
import com.magidoc.security.SecurityUtils;
import com.magidoc.workspace.WorkspaceDtos.SaveWorkspace;
import com.magidoc.workspace.WorkspaceDtos.WorkspaceDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class WorkspaceService {

    private final WorkspaceRepository workspaces;
    private final WorkspaceMemberRepository members;
    private final WorkspaceTeamRepository workspaceTeams;
    private final WorkspaceAccessService access;
    private final EnvironmentRepository environments;
    private final ApiCollectionRepository collections;
    private final ActivityService activity;

    @Transactional(readOnly = true)
    public List<WorkspaceDto> listMine() {
        Map<UUID, WorkspaceRole> roles = access.accessibleWorkspaces(SecurityUtils.currentUserId());
        return workspaces.findAllById(roles.keySet()).stream()
                .sorted(Comparator.comparing(Workspace::getCreatedAt))
                .map(w -> toDto(w, roles.get(w.getId())))
                .toList();
    }

    @Transactional(readOnly = true)
    public WorkspaceDto get(UUID id) {
        WorkspaceRole role = access.require(id, WorkspaceRole.VIEWER);
        return toDto(load(id), role);
    }

    @Transactional
    public WorkspaceDto create(SaveWorkspace req) {
        Workspace ws = createFor(SecurityUtils.currentUserId(), req.name().trim(), req.description());
        return toDto(ws, WorkspaceRole.OWNER);
    }

    /** Creates a workspace owned by {@code ownerId} with its owner membership and global environment. */
    @Transactional
    public Workspace createFor(UUID ownerId, String name, String description) {
        Workspace ws = new Workspace();
        ws.setName(name);
        ws.setDescription(description);
        ws.setOwnerId(ownerId);
        ws = workspaces.save(ws);

        WorkspaceMember owner = new WorkspaceMember();
        owner.setWorkspaceId(ws.getId());
        owner.setUserId(ownerId);
        owner.setRole(WorkspaceRole.OWNER);
        members.save(owner);

        Environment globals = new Environment();
        globals.setWorkspaceId(ws.getId());
        globals.setName("Globals");
        globals.setGlobal(true);
        globals.setVariables("[]");
        environments.save(globals);

        activity.log(ws.getId(), ownerId, "created", "workspace", name);
        return ws;
    }

    @Transactional
    public WorkspaceDto update(UUID id, SaveWorkspace req) {
        WorkspaceRole role = access.require(id, WorkspaceRole.ADMIN);
        Workspace ws = load(id);
        ws.setName(req.name().trim());
        ws.setDescription(req.description());
        activity.log(id, SecurityUtils.currentUserId(), "updated", "workspace", ws.getName());
        return toDto(ws, role);
    }

    @Transactional
    public void delete(UUID id) {
        access.require(id, WorkspaceRole.OWNER);
        workspaces.delete(load(id));
    }

    @Transactional
    public void leave(UUID id) {
        access.require(id, WorkspaceRole.VIEWER);
        UUID userId = SecurityUtils.currentUserId();
        WorkspaceMember m = members.findByWorkspaceIdAndUserId(id, userId)
                .orElseThrow(() -> ApiException.badRequest(
                        "You have access through a team. Ask a team admin to remove you from the team."));
        if (m.getRole() == WorkspaceRole.OWNER) {
            throw ApiException.badRequest("The owner can't leave the workspace. Delete it instead.");
        }
        members.delete(m);
        activity.log(id, userId, "left", "workspace", load(id).getName());
    }

    Workspace load(UUID id) {
        return workspaces.findById(id).orElseThrow(() -> ApiException.notFound("Workspace"));
    }

    private WorkspaceDto toDto(Workspace w, WorkspaceRole role) {
        long memberCount = members.countByWorkspaceId(w.getId());
        long teamCount = workspaceTeams.findByWorkspaceIdOrderByCreatedAtAsc(w.getId()).size();
        return new WorkspaceDto(w.getId(), w.getName(), w.getDescription(), w.getOwnerId(), role,
                memberCount + teamCount, collections.countByWorkspaceId(w.getId()), w.getCreatedAt(), w.getUpdatedAt());
    }
}
