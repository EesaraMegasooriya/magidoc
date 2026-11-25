package com.magidoc.workspace;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class WorkspaceDtos {

    private WorkspaceDtos() {
    }

    public record WorkspaceDto(UUID id, String name, String description, UUID ownerId, WorkspaceRole role,
                               long memberCount, long collectionCount, Instant createdAt, Instant updatedAt) {
    }

    public record SaveWorkspace(@NotBlank @Size(max = 120) String name, @Size(max = 1000) String description) {
    }

    public record MemberDto(UUID id, UUID userId, String name, String email, String avatarColor,
                            WorkspaceRole role, Instant createdAt) {
    }

    public record WorkspaceTeamDto(UUID id, UUID teamId, String teamName, long memberCount,
                                   WorkspaceRole role, Instant createdAt) {
    }

    /** code is formatted for display (e.g. K7QM-X2PD) and only returned to admins; null when disabled. */
    public record JoinCodeDto(String code, WorkspaceRole role, boolean enabled) {
    }

    /** joinCode is null for callers below ADMIN. */
    public record MembersResponse(List<MemberDto> members, List<WorkspaceTeamDto> teams, JoinCodeDto joinCode) {
    }

    public record JoinCodeSettings(@NotNull WorkspaceRole role) {
    }

    public record JoinRequest(@NotBlank @Size(max = 32) String code) {
    }

    /** Adds an existing MagiDoc user directly. People without an account join with the workspace code. */
    public record AddMemberRequest(@NotBlank @Email String email, @NotNull WorkspaceRole role) {
    }

    public record AddMemberResult(String message) {
    }

    public record RoleUpdate(@NotNull WorkspaceRole role) {
    }

    public record AddTeamRequest(@NotNull UUID teamId, @NotNull WorkspaceRole role) {
    }
}
