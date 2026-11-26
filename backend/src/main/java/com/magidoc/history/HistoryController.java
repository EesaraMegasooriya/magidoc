package com.magidoc.history;

import com.magidoc.collection.ApiRequestRepository;
import com.magidoc.collection.RequestService;
import com.magidoc.security.SecurityUtils;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import com.magidoc.workspace.WorkspaceAccessService;
import com.magidoc.workspace.WorkspaceRole;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
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
    private final ApiRequestRepository requests;

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

    /** A request sent from the user's browser or Local Agent (not via the server runner). */
    public record RecordHistory(@NotBlank @Size(max = 10) String method, @NotBlank @Size(max = 8000) String url,
                                UUID requestId, @Size(max = 200) String requestName, Integer statusCode,
                                Long durationMs, Long responseSize) {
    }

    @PostMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void record(@PathVariable UUID workspaceId, @Valid @RequestBody RecordHistory req) {
        access.require(workspaceId, WorkspaceRole.VIEWER);
        RequestHistory h = new RequestHistory();
        h.setWorkspaceId(workspaceId);
        h.setUserId(SecurityUtils.currentUserId());
        h.setRequestId(req.requestId() != null && requests.existsById(req.requestId()) ? req.requestId() : null);
        h.setRequestName(req.requestName());
        h.setMethod(RequestService.normalizeMethod(req.method()));
        h.setUrl(req.url().length() > 4000 ? req.url().substring(0, 4000) : req.url());
        h.setStatusCode(req.statusCode() == null || req.statusCode() <= 0 ? null : req.statusCode());
        h.setDurationMs(req.durationMs());
        h.setResponseSize(req.responseSize());
        history.save(h);
    }

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void clear(@PathVariable UUID workspaceId) {
        access.require(workspaceId, WorkspaceRole.VIEWER);
        history.deleteAllForUser(workspaceId, SecurityUtils.currentUserId());
    }
}
