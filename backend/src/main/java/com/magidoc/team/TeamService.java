package com.magidoc.team;

import com.magidoc.common.ApiException;
import com.magidoc.security.SecurityUtils;
import com.magidoc.team.TeamDtos.AddTeamMember;
import com.magidoc.team.TeamDtos.SaveTeam;
import com.magidoc.team.TeamDtos.TeamDetail;
import com.magidoc.team.TeamDtos.TeamDto;
import com.magidoc.team.TeamDtos.TeamMemberDto;
import com.magidoc.team.TeamDtos.TeamWorkspaceDto;
import com.magidoc.user.User;
import com.magidoc.user.UserRepository;
import com.magidoc.workspace.Workspace;
import com.magidoc.workspace.WorkspaceRepository;
import com.magidoc.workspace.WorkspaceTeam;
import com.magidoc.workspace.WorkspaceTeamRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TeamService {

    private final TeamRepository teams;
    private final TeamMemberRepository teamMembers;
    private final UserRepository users;
    private final WorkspaceTeamRepository workspaceTeams;
    private final WorkspaceRepository workspaces;

    @Transactional(readOnly = true)
    public List<TeamDto> listMine() {
        List<TeamMember> mine = teamMembers.findByUserId(SecurityUtils.currentUserId());
        Map<UUID, Team> byId = teams.mapByIds(mine.stream().map(TeamMember::getTeamId).toList());
        return mine.stream()
                .filter(m -> byId.containsKey(m.getTeamId()))
                .map(m -> toDto(byId.get(m.getTeamId()), m.getRole()))
                .sorted(Comparator.comparing(TeamDto::name, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    @Transactional
    public TeamDto create(SaveTeam req) {
        UUID userId = SecurityUtils.currentUserId();
        Team t = new Team();
        t.setName(req.name().trim());
        t.setDescription(req.description());
        t.setOwnerId(userId);
        t = teams.save(t);

        TeamMember owner = new TeamMember();
        owner.setTeamId(t.getId());
        owner.setUserId(userId);
        owner.setRole(TeamRole.OWNER);
        teamMembers.save(owner);
        return toDto(t, TeamRole.OWNER);
    }

    @Transactional(readOnly = true)
    public TeamDetail get(UUID teamId) {
        TeamRole myRole = require(teamId, TeamRole.MEMBER);
        Team team = load(teamId);

        List<TeamMember> ms = teamMembers.findByTeamIdOrderByCreatedAtAsc(teamId);
        Map<UUID, User> usersById = users.mapByIds(ms.stream().map(TeamMember::getUserId).toList());
        List<TeamMemberDto> memberDtos = ms.stream()
                .filter(m -> usersById.containsKey(m.getUserId()))
                .map(m -> {
                    User u = usersById.get(m.getUserId());
                    return new TeamMemberDto(m.getId(), u.getId(), u.getName(), u.getEmail(), u.getAvatarColor(),
                            m.getRole(), m.getCreatedAt());
                }).toList();

        List<WorkspaceTeam> wts = workspaceTeams.findByTeamId(teamId);
        Map<UUID, Workspace> wsById = workspaces.findAllById(wts.stream().map(WorkspaceTeam::getWorkspaceId).toList())
                .stream().collect(Collectors.toMap(Workspace::getId, Function.identity()));
        List<TeamWorkspaceDto> wsDtos = wts.stream()
                .filter(wt -> wsById.containsKey(wt.getWorkspaceId()))
                .map(wt -> new TeamWorkspaceDto(wt.getWorkspaceId(), wsById.get(wt.getWorkspaceId()).getName(),
                        wt.getRole()))
                .toList();

        return new TeamDetail(toDto(team, myRole), memberDtos, wsDtos);
    }

    @Transactional
    public TeamDto update(UUID teamId, SaveTeam req) {
        TeamRole myRole = require(teamId, TeamRole.ADMIN);
        Team t = load(teamId);
        t.setName(req.name().trim());
        t.setDescription(req.description());
        return toDto(t, myRole);
    }

    @Transactional
    public void delete(UUID teamId) {
        require(teamId, TeamRole.OWNER);
        teams.delete(load(teamId));
    }

    @Transactional
    public TeamMemberDto addMember(UUID teamId, AddTeamMember req) {
        TeamRole myRole = require(teamId, TeamRole.ADMIN);
        assertAssignable(req.role(), myRole);
        User u = users.findByEmailIgnoreCase(req.email().trim())
                .orElseThrow(() -> ApiException.badRequest(
                        "No MagiDoc account uses " + req.email() + ". Ask them to sign up first."));
        if (teamMembers.existsByTeamIdAndUserId(teamId, u.getId())) {
            throw ApiException.conflict(u.getName() + " is already in this team");
        }
        TeamMember m = new TeamMember();
        m.setTeamId(teamId);
        m.setUserId(u.getId());
        m.setRole(req.role());
        m = teamMembers.save(m);
        return new TeamMemberDto(m.getId(), u.getId(), u.getName(), u.getEmail(), u.getAvatarColor(), m.getRole(),
                m.getCreatedAt());
    }

    @Transactional
    public void updateMemberRole(UUID teamId, UUID memberId, TeamRole role) {
        TeamRole myRole = require(teamId, TeamRole.ADMIN);
        TeamMember m = loadMember(teamId, memberId);
        assertManageable(m, myRole);
        assertAssignable(role, myRole);
        m.setRole(role);
    }

    @Transactional
    public void removeMember(UUID teamId, UUID memberId) {
        TeamMember m = loadMember(teamId, memberId);
        UUID me = SecurityUtils.currentUserId();
        if (m.getUserId().equals(me)) {
            // leaving the team
            require(teamId, TeamRole.MEMBER);
            if (m.getRole() == TeamRole.OWNER) {
                throw ApiException.badRequest("The team owner can't leave. Delete the team instead.");
            }
        } else {
            TeamRole myRole = require(teamId, TeamRole.ADMIN);
            assertManageable(m, myRole);
        }
        teamMembers.delete(m);
    }

    private TeamRole require(UUID teamId, TeamRole min) {
        TeamMember me = teamMembers.findByTeamIdAndUserId(teamId, SecurityUtils.currentUserId())
                .orElseThrow(() -> ApiException.notFound("Team"));
        if (!me.getRole().atLeast(min)) {
            throw ApiException.forbidden("This action requires team " + min.name().toLowerCase() + " access");
        }
        return me.getRole();
    }

    private static void assertAssignable(TeamRole role, TeamRole myRole) {
        if (role == TeamRole.OWNER) {
            throw ApiException.badRequest("Ownership can't be assigned");
        }
        if (role == TeamRole.ADMIN && myRole != TeamRole.OWNER) {
            throw ApiException.forbidden("Only the team owner can grant admin access");
        }
    }

    private static void assertManageable(TeamMember target, TeamRole myRole) {
        if (target.getRole() == TeamRole.OWNER) {
            throw ApiException.forbidden("The team owner can't be changed or removed");
        }
        if (target.getRole() == TeamRole.ADMIN && myRole != TeamRole.OWNER) {
            throw ApiException.forbidden("Only the team owner can manage admins");
        }
    }

    private Team load(UUID id) {
        return teams.findById(id).orElseThrow(() -> ApiException.notFound("Team"));
    }

    private TeamMember loadMember(UUID teamId, UUID memberId) {
        return teamMembers.findById(memberId)
                .filter(m -> m.getTeamId().equals(teamId))
                .orElseThrow(() -> ApiException.notFound("Team member"));
    }

    private TeamDto toDto(Team t, TeamRole myRole) {
        return new TeamDto(t.getId(), t.getName(), t.getDescription(), t.getOwnerId(), myRole,
                teamMembers.countByTeamId(t.getId()), t.getCreatedAt());
    }
}
