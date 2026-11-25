package com.magidoc.team;

import com.magidoc.workspace.WorkspaceRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class TeamDtos {

    private TeamDtos() {
    }

    public record TeamDto(UUID id, String name, String description, UUID ownerId, TeamRole myRole,
                          long memberCount, Instant createdAt) {
    }

    public record TeamMemberDto(UUID id, UUID userId, String name, String email, String avatarColor,
                                TeamRole role, Instant createdAt) {
    }

    public record TeamWorkspaceDto(UUID workspaceId, String workspaceName, WorkspaceRole role) {
    }

    public record TeamDetail(TeamDto team, List<TeamMemberDto> members, List<TeamWorkspaceDto> workspaces) {
    }

    public record SaveTeam(@NotBlank @Size(max = 120) String name, @Size(max = 1000) String description) {
    }

    public record AddTeamMember(@NotBlank @Email String email, @NotNull TeamRole role) {
    }

    public record TeamRoleUpdate(@NotNull TeamRole role) {
    }
}
