package com.magidoc.workspace;

import com.magidoc.common.ApiException;
import com.magidoc.security.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Resolves a user's effective role in a workspace: the highest of their direct membership
 * and every team that has been granted access.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class WorkspaceAccessService {

    private final WorkspaceMemberRepository members;
    private final WorkspaceTeamRepository workspaceTeams;

    public Optional<WorkspaceRole> roleOf(UUID workspaceId, UUID userId) {
        WorkspaceRole best = members.findByWorkspaceIdAndUserId(workspaceId, userId)
                .map(WorkspaceMember::getRole).orElse(null);
        for (WorkspaceTeam wt : workspaceTeams.findByWorkspaceAndUser(workspaceId, userId)) {
            best = WorkspaceRole.max(best, wt.getRole());
        }
        return Optional.ofNullable(best);
    }

    /** Ensures the current user has at least {@code min} role; returns the effective role. */
    public WorkspaceRole require(UUID workspaceId, WorkspaceRole min) {
        UUID userId = SecurityUtils.currentUserId();
        // 404 (not 403) when no access at all, so workspace ids can't be probed.
        WorkspaceRole role = roleOf(workspaceId, userId).orElseThrow(() -> ApiException.notFound("Workspace"));
        if (!role.atLeast(min)) {
            throw ApiException.forbidden("This action requires " + min.name().toLowerCase() + " access");
        }
        return role;
    }

    public Map<UUID, WorkspaceRole> accessibleWorkspaces(UUID userId) {
        Map<UUID, WorkspaceRole> result = new HashMap<>();
        for (WorkspaceMember m : members.findByUserId(userId)) {
            result.merge(m.getWorkspaceId(), m.getRole(), WorkspaceRole::max);
        }
        for (WorkspaceTeam wt : workspaceTeams.findAccessibleByUser(userId)) {
            result.merge(wt.getWorkspaceId(), wt.getRole(), WorkspaceRole::max);
        }
        return result;
    }
}
