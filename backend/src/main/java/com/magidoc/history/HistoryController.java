package com.magidoc.history;

import com.magidoc.security.SecurityUtils;
import com.magidoc.workspace.WorkspaceAccessService;
import com.magidoc.workspace.WorkspaceRole;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/workspaces/{workspaceId}/history")
@RequiredArgsConstructor
public class HistoryController {

    private final RequestHistoryRepository history;
    private final WorkspaceAccessService access;

    public record HistoryDto(UUID id, UUID requestId, String requestName, String method, String url,
                             Integer statusCode, Long durationMs, Long responseSize, Instant createdAt) {
    }

    @GetMapping
    @Transactional(readOnly = true)
    public List<HistoryDto> list(@PathVariable UUID workspaceId, @RequestParam(defaultValue = "100") int limit) {
        access.require(workspaceId, WorkspaceRole.VIEWER);
        return history.findByWorkspaceIdAndUserIdOrderByCreatedAtDesc(workspaceId, SecurityUtils.currentUserId(),
                        PageRequest.of(0, Math.max(1, Math.min(limit, 500))))
                .stream()
                .map(h -> new HistoryDto(h.getId(), h.getRequestId(), h.getRequestName(), h.getMethod(), h.getUrl(),
                        h.getStatusCode(), h.getDurationMs(), h.getResponseSize(), h.getCreatedAt()))
                .toList();
    }

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void clear(@PathVariable UUID workspaceId) {
        access.require(workspaceId, WorkspaceRole.VIEWER);
        history.deleteAllForUser(workspaceId, SecurityUtils.currentUserId());
    }
}
