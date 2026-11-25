package com.magidoc.workspace;

import com.magidoc.activity.ActivityService;
import com.magidoc.common.AttemptLimiter;
import com.magidoc.common.AttemptLimiter.Policy;
import com.magidoc.common.ApiException;
import com.magidoc.security.SecurityUtils;
import com.magidoc.team.Team;
import com.magidoc.team.TeamMemberRepository;
import com.magidoc.team.TeamRepository;
import com.magidoc.user.User;
import com.magidoc.user.UserRepository;
import com.magidoc.workspace.WorkspaceDtos.AddMemberRequest;
import com.magidoc.workspace.WorkspaceDtos.AddMemberResult;
import com.magidoc.workspace.WorkspaceDtos.AddTeamRequest;
import com.magidoc.workspace.WorkspaceDtos.JoinCodeDto;
import com.magidoc.workspace.WorkspaceDtos.MemberDto;
import com.magidoc.workspace.WorkspaceDtos.MembersResponse;
import com.magidoc.workspace.WorkspaceDtos.WorkspaceTeamDto;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class WorkspaceMemberService {

    /** Unambiguous characters only (no 0/O, 1/I/L) so codes are easy to read aloud and type. */
    private static final char[] CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789".toCharArray();
    private static final int CODE_LENGTH = 8;
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String MEMBER = "member";
    private static final String WORKSPACE = "workspace";

    private final WorkspaceRepository workspaces;
    private final WorkspaceMemberRepository members;
    private final WorkspaceTeamRepository workspaceTeams;
    private final WorkspaceAccessService access;
    private final UserRepository users;
    private final TeamRepository teams;
    private final TeamMemberRepository teamMembers;
    private final ActivityService activity;
    private final AttemptLimiter limiter;

    @Transactional(readOnly = true)
    public MembersResponse list(UUID workspaceId) {
        WorkspaceRole callerRole = access.require(workspaceId, WorkspaceRole.VIEWER);

        List<WorkspaceMember> ms = members.findByWorkspaceIdOrderByCreatedAtAsc(workspaceId);
        Map<UUID, User> byId = users.mapByIds(ms.stream().map(WorkspaceMember::getUserId).toList());
        List<MemberDto> memberDtos = ms.stream()
                .filter(m -> byId.containsKey(m.getUserId()))
                .map(m -> {
                    User u = byId.get(m.getUserId());
                    return new MemberDto(m.getId(), u.getId(), u.getName(), u.getEmail(), u.getAvatarColor(),
                            m.getRole(), m.getCreatedAt());
                }).toList();

        List<WorkspaceTeam> wts = workspaceTeams.findByWorkspaceIdOrderByCreatedAtAsc(workspaceId);
        Map<UUID, Team> teamsById = teams.mapByIds(wts.stream().map(WorkspaceTeam::getTeamId).toList());
        List<WorkspaceTeamDto> teamDtos = wts.stream()
                .filter(wt -> teamsById.containsKey(wt.getTeamId()))
                .map(wt -> new WorkspaceTeamDto(wt.getId(), wt.getTeamId(), teamsById.get(wt.getTeamId()).getName(),
                        teamMembers.countByTeamId(wt.getTeamId()), wt.getRole(), wt.getCreatedAt()))
                .toList();

        // The join code is a secret: only admins (who can regenerate it anyway) receive it.
        JoinCodeDto joinCode = callerRole.atLeast(WorkspaceRole.ADMIN) ? toJoinCodeDto(loadWorkspace(workspaceId)) : null;
        return new MembersResponse(memberDtos, teamDtos, joinCode);
    }

    /** Adds an existing MagiDoc user directly. People without an account sign up and use the join code. */
    @Transactional
    public AddMemberResult addMember(UUID workspaceId, AddMemberRequest req) {
        WorkspaceRole callerRole = access.require(workspaceId, WorkspaceRole.ADMIN);
        assertAssignable(req.role(), callerRole);
        String address = req.email().trim().toLowerCase(Locale.ROOT);
        User u = users.findByEmailIgnoreCase(address).orElseThrow(() -> ApiException.badRequest(
                "No MagiDoc account uses " + address + ". Share the workspace join code with them instead."));
        if (members.existsByWorkspaceIdAndUserId(workspaceId, u.getId())) {
            throw ApiException.conflict(u.getName() + " is already a member of this workspace");
        }
        saveMember(workspaceId, u.getId(), req.role());
        activity.log(workspaceId, SecurityUtils.currentUserId(), "added", MEMBER, u.getName());
        return new AddMemberResult(u.getName() + " now has access to this workspace.");
    }

    // ------------------------------------------------------------------ join codes

    /** Creates (or replaces) the workspace join code. The previous code stops working immediately. */
    @Transactional
    public JoinCodeDto generateJoinCode(UUID workspaceId, WorkspaceRole role) {
        access.require(workspaceId, WorkspaceRole.ADMIN);
        assertJoinRole(role);
        Workspace ws = loadWorkspace(workspaceId);
        String code;
        do {
            code = randomCode();
        } while (workspaces.existsByJoinCode(code));
        ws.setJoinCode(code);
        ws.setJoinRole(role);
        workspaces.saveAndFlush(ws);
        activity.log(workspaceId, SecurityUtils.currentUserId(), "generated a join code for", WORKSPACE, ws.getName());
        return toJoinCodeDto(ws);
    }

    @Transactional
    public JoinCodeDto updateJoinRole(UUID workspaceId, WorkspaceRole role) {
        access.require(workspaceId, WorkspaceRole.ADMIN);
        assertJoinRole(role);
        Workspace ws = loadWorkspace(workspaceId);
        ws.setJoinRole(role);
        return toJoinCodeDto(workspaces.saveAndFlush(ws));
    }

    @Transactional
    public void disableJoinCode(UUID workspaceId) {
        access.require(workspaceId, WorkspaceRole.ADMIN);
        Workspace ws = loadWorkspace(workspaceId);
        ws.setJoinCode(null);
        workspaces.saveAndFlush(ws);
        activity.log(workspaceId, SecurityUtils.currentUserId(), "disabled the join code for", WORKSPACE, ws.getName());
    }

    /** Joins the workspace identified by the code. Returns its id. Idempotent for existing members. */
    @Transactional
    public UUID join(String rawCode) {
        UUID userId = SecurityUtils.currentUserId();
        limiter.checkAllowed(Policy.JOIN_CODE, userId.toString());
        String code = normalize(rawCode);
        Workspace ws = code.length() == CODE_LENGTH ? workspaces.findByJoinCode(code).orElse(null) : null;
        if (ws == null) {
            limiter.recordFailure(Policy.JOIN_CODE, userId.toString());
            throw new ApiException(HttpStatus.NOT_FOUND,
                    "No workspace matches this code. Check it, or ask an admin for the current code.");
        }
        limiter.reset(Policy.JOIN_CODE, userId.toString());
        if (!members.existsByWorkspaceIdAndUserId(ws.getId(), userId)) {
            saveMember(ws.getId(), userId, ws.getJoinRole());
            String name = users.findById(userId).map(User::getName).orElse("Someone");
            activity.log(ws.getId(), userId, "joined with code", WORKSPACE, name);
        }
        return ws.getId();
    }

    /** Accepts "k7qm-x2pd", "K7QM X2PD", etc. */
    static String normalize(String raw) {
        return raw == null ? "" : raw.toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]", "");
    }

    static String format(String code) {
        return code == null ? null : code.substring(0, 4) + "-" + code.substring(4);
    }

    private static String randomCode() {
        char[] out = new char[CODE_LENGTH];
        for (int i = 0; i < CODE_LENGTH; i++) out[i] = CODE_ALPHABET[RANDOM.nextInt(CODE_ALPHABET.length)];
        return new String(out);
    }

    private static JoinCodeDto toJoinCodeDto(Workspace ws) {
        return new JoinCodeDto(format(ws.getJoinCode()), ws.getJoinRole(), ws.getJoinCode() != null);
    }

    /** A shareable code may grant at most Editor access; admins are always promoted explicitly. */
    private static void assertJoinRole(WorkspaceRole role) {
        if (role != WorkspaceRole.VIEWER && role != WorkspaceRole.EDITOR) {
            throw ApiException.badRequest("Join codes can grant Viewer or Editor access only");
        }
    }

    // ------------------------------------------------------------------ members & teams

    @Transactional
    public void updateMemberRole(UUID workspaceId, UUID memberId, WorkspaceRole newRole) {
        WorkspaceRole callerRole = access.require(workspaceId, WorkspaceRole.ADMIN);
        WorkspaceMember m = loadMember(workspaceId, memberId);
        assertManageable(m.getRole(), callerRole);
        assertAssignable(newRole, callerRole);
        m.setRole(newRole);
        activity.log(workspaceId, SecurityUtils.currentUserId(), "changed role of", MEMBER, userName(m.getUserId()));
    }

    @Transactional
    public void removeMember(UUID workspaceId, UUID memberId) {
        WorkspaceRole callerRole = access.require(workspaceId, WorkspaceRole.ADMIN);
        WorkspaceMember m = loadMember(workspaceId, memberId);
        assertManageable(m.getRole(), callerRole);
        members.delete(m);
        activity.log(workspaceId, SecurityUtils.currentUserId(), "removed", MEMBER, userName(m.getUserId()));
    }

    @Transactional
    public void addTeam(UUID workspaceId, AddTeamRequest req) {
        WorkspaceRole callerRole = access.require(workspaceId, WorkspaceRole.ADMIN);
        assertAssignable(req.role(), callerRole);
        Team team = teams.findById(req.teamId()).orElseThrow(() -> ApiException.notFound("Team"));
        if (!teamMembers.existsByTeamIdAndUserId(team.getId(), SecurityUtils.currentUserId())) {
            throw ApiException.forbidden("You can only share with teams you belong to");
        }
        if (workspaceTeams.findByWorkspaceIdAndTeamId(workspaceId, team.getId()).isPresent()) {
            throw ApiException.conflict(team.getName() + " already has access");
        }
        WorkspaceTeam wt = new WorkspaceTeam();
        wt.setWorkspaceId(workspaceId);
        wt.setTeamId(team.getId());
        wt.setRole(req.role());
        workspaceTeams.save(wt);
        activity.log(workspaceId, SecurityUtils.currentUserId(), "shared with", "team", team.getName());
    }

    @Transactional
    public void updateTeamRole(UUID workspaceId, UUID workspaceTeamId, WorkspaceRole newRole) {
        WorkspaceRole callerRole = access.require(workspaceId, WorkspaceRole.ADMIN);
        WorkspaceTeam wt = loadWorkspaceTeam(workspaceId, workspaceTeamId);
        assertManageable(wt.getRole(), callerRole);
        assertAssignable(newRole, callerRole);
        wt.setRole(newRole);
    }

    @Transactional
    public void removeTeam(UUID workspaceId, UUID workspaceTeamId) {
        WorkspaceRole callerRole = access.require(workspaceId, WorkspaceRole.ADMIN);
        WorkspaceTeam wt = loadWorkspaceTeam(workspaceId, workspaceTeamId);
        assertManageable(wt.getRole(), callerRole);
        workspaceTeams.delete(wt);
        activity.log(workspaceId, SecurityUtils.currentUserId(), "removed", "team",
                teams.findById(wt.getTeamId()).map(Team::getName).orElse("team"));
    }

    private void saveMember(UUID workspaceId, UUID userId, WorkspaceRole role) {
        WorkspaceMember m = new WorkspaceMember();
        m.setWorkspaceId(workspaceId);
        m.setUserId(userId);
        m.setRole(role);
        members.save(m);
    }

    /** Nobody can grant OWNER; only the owner can grant ADMIN. */
    private static void assertAssignable(WorkspaceRole target, WorkspaceRole callerRole) {
        if (target == WorkspaceRole.OWNER) {
            throw ApiException.badRequest("Ownership can't be assigned");
        }
        if (target == WorkspaceRole.ADMIN && callerRole != WorkspaceRole.OWNER) {
            throw ApiException.forbidden("Only the workspace owner can grant admin access");
        }
    }

    /** The owner is untouchable; admins can only be managed by the owner. */
    private static void assertManageable(WorkspaceRole current, WorkspaceRole callerRole) {
        if (current == WorkspaceRole.OWNER) {
            throw ApiException.forbidden("The workspace owner can't be changed or removed");
        }
        if (current == WorkspaceRole.ADMIN && callerRole != WorkspaceRole.OWNER) {
            throw ApiException.forbidden("Only the workspace owner can manage admins");
        }
    }

    private Workspace loadWorkspace(UUID id) {
        return workspaces.findById(id).orElseThrow(() -> ApiException.notFound("Workspace"));
    }

    private WorkspaceMember loadMember(UUID workspaceId, UUID memberId) {
        return members.findById(memberId)
                .filter(m -> m.getWorkspaceId().equals(workspaceId))
                .orElseThrow(() -> ApiException.notFound("Member"));
    }

    private WorkspaceTeam loadWorkspaceTeam(UUID workspaceId, UUID id) {
        return workspaceTeams.findById(id)
                .filter(wt -> wt.getWorkspaceId().equals(workspaceId))
                .orElseThrow(() -> ApiException.notFound("Team access"));
    }

    private String userName(UUID userId) {
        return users.findById(userId).map(User::getName).orElse(MEMBER);
    }
}
