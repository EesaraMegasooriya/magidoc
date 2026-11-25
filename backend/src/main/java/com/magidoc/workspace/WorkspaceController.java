package com.magidoc.workspace;

import com.magidoc.activity.ActivityService;
import com.magidoc.activity.ActivityService.ActivityDto;
import com.magidoc.workspace.WorkspaceDtos.AddTeamRequest;
import com.magidoc.workspace.WorkspaceDtos.AddMemberRequest;
import com.magidoc.workspace.WorkspaceDtos.AddMemberResult;
import com.magidoc.workspace.WorkspaceDtos.JoinCodeDto;
import com.magidoc.workspace.WorkspaceDtos.JoinCodeSettings;
import com.magidoc.workspace.WorkspaceDtos.JoinRequest;
import com.magidoc.workspace.WorkspaceDtos.MembersResponse;
import com.magidoc.workspace.WorkspaceDtos.RoleUpdate;
import com.magidoc.workspace.WorkspaceDtos.SaveWorkspace;
import com.magidoc.workspace.WorkspaceDtos.WorkspaceDto;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/workspaces")
@RequiredArgsConstructor
public class WorkspaceController {

    private final WorkspaceService workspaceService;
    private final WorkspaceMemberService memberService;
    private final WorkspaceAccessService access;
    private final ActivityService activityService;

    @GetMapping
    public List<WorkspaceDto> list() {
        return workspaceService.listMine();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public WorkspaceDto create(@Valid @RequestBody SaveWorkspace req) {
        return workspaceService.create(req);
    }

    /** Join a workspace with its join code. */
    @PostMapping("/join")
    public WorkspaceDto join(@Valid @RequestBody JoinRequest req) {
        return workspaceService.get(memberService.join(req.code()));
    }

    @GetMapping("/{id}")
    public WorkspaceDto get(@PathVariable UUID id) {
        return workspaceService.get(id);
    }

    @PutMapping("/{id}")
    public WorkspaceDto update(@PathVariable UUID id, @Valid @RequestBody SaveWorkspace req) {
        return workspaceService.update(id, req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        workspaceService.delete(id);
    }

    @PostMapping("/{id}/leave")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void leave(@PathVariable UUID id) {
        workspaceService.leave(id);
    }

    @GetMapping("/{id}/activity")
    public List<ActivityDto> activity(@PathVariable UUID id, @RequestParam(defaultValue = "50") int limit) {
        access.require(id, WorkspaceRole.VIEWER);
        return activityService.recent(id, limit);
    }

    // ---- Members, invitations & teams ----

    @GetMapping("/{id}/members")
    public MembersResponse members(@PathVariable UUID id) {
        return memberService.list(id);
    }

    @PostMapping("/{id}/members")
    public AddMemberResult addMember(@PathVariable UUID id, @Valid @RequestBody AddMemberRequest req) {
        return memberService.addMember(id, req);
    }

    // ---- Join code ----

    /** Creates a new join code (replacing any existing one). */
    @PostMapping("/{id}/join-code")
    public JoinCodeDto generateJoinCode(@PathVariable UUID id, @Valid @RequestBody JoinCodeSettings req) {
        return memberService.generateJoinCode(id, req.role());
    }

    @PutMapping("/{id}/join-code")
    public JoinCodeDto updateJoinCode(@PathVariable UUID id, @Valid @RequestBody JoinCodeSettings req) {
        return memberService.updateJoinRole(id, req.role());
    }

    @DeleteMapping("/{id}/join-code")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void disableJoinCode(@PathVariable UUID id) {
        memberService.disableJoinCode(id);
    }

    @PutMapping("/{id}/members/{memberId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void updateMember(@PathVariable UUID id, @PathVariable UUID memberId, @Valid @RequestBody RoleUpdate req) {
        memberService.updateMemberRole(id, memberId, req.role());
    }

    @DeleteMapping("/{id}/members/{memberId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeMember(@PathVariable UUID id, @PathVariable UUID memberId) {
        memberService.removeMember(id, memberId);
    }

    @PostMapping("/{id}/teams")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void addTeam(@PathVariable UUID id, @Valid @RequestBody AddTeamRequest req) {
        memberService.addTeam(id, req);
    }

    @PutMapping("/{id}/teams/{workspaceTeamId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void updateTeam(@PathVariable UUID id, @PathVariable UUID workspaceTeamId,
                           @Valid @RequestBody RoleUpdate req) {
        memberService.updateTeamRole(id, workspaceTeamId, req.role());
    }

    @DeleteMapping("/{id}/teams/{workspaceTeamId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeTeam(@PathVariable UUID id, @PathVariable UUID workspaceTeamId) {
        memberService.removeTeam(id, workspaceTeamId);
    }
}
