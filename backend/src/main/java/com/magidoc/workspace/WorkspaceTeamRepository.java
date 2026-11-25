package com.magidoc.workspace;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WorkspaceTeamRepository extends JpaRepository<WorkspaceTeam, UUID> {

    List<WorkspaceTeam> findByWorkspaceIdOrderByCreatedAtAsc(UUID workspaceId);

    List<WorkspaceTeam> findByTeamId(UUID teamId);

    Optional<WorkspaceTeam> findByWorkspaceIdAndTeamId(UUID workspaceId, UUID teamId);

    @Query("select wt from WorkspaceTeam wt, TeamMember tm where wt.teamId = tm.teamId and tm.userId = :userId")
    List<WorkspaceTeam> findAccessibleByUser(@Param("userId") UUID userId);

    @Query("select wt from WorkspaceTeam wt, TeamMember tm "
            + "where wt.teamId = tm.teamId and tm.userId = :userId and wt.workspaceId = :workspaceId")
    List<WorkspaceTeam> findByWorkspaceAndUser(@Param("workspaceId") UUID workspaceId, @Param("userId") UUID userId);
}
