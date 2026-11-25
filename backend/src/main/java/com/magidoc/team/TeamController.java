package com.magidoc.team;

import com.magidoc.team.TeamDtos.AddTeamMember;
import com.magidoc.team.TeamDtos.SaveTeam;
import com.magidoc.team.TeamDtos.TeamDetail;
import com.magidoc.team.TeamDtos.TeamDto;
import com.magidoc.team.TeamDtos.TeamMemberDto;
import com.magidoc.team.TeamDtos.TeamRoleUpdate;
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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/teams")
@RequiredArgsConstructor
public class TeamController {

    private final TeamService teamService;

    @GetMapping
    public List<TeamDto> list() {
        return teamService.listMine();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TeamDto create(@Valid @RequestBody SaveTeam req) {
        return teamService.create(req);
    }

    @GetMapping("/{id}")
    public TeamDetail get(@PathVariable UUID id) {
        return teamService.get(id);
    }

    @PutMapping("/{id}")
    public TeamDto update(@PathVariable UUID id, @Valid @RequestBody SaveTeam req) {
        return teamService.update(id, req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        teamService.delete(id);
    }

    @PostMapping("/{id}/members")
    @ResponseStatus(HttpStatus.CREATED)
    public TeamMemberDto addMember(@PathVariable UUID id, @Valid @RequestBody AddTeamMember req) {
        return teamService.addMember(id, req);
    }

    @PutMapping("/{id}/members/{memberId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void updateMember(@PathVariable UUID id, @PathVariable UUID memberId,
                             @Valid @RequestBody TeamRoleUpdate req) {
        teamService.updateMemberRole(id, memberId, req.role());
    }

    @DeleteMapping("/{id}/members/{memberId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeMember(@PathVariable UUID id, @PathVariable UUID memberId) {
        teamService.removeMember(id, memberId);
    }
}
