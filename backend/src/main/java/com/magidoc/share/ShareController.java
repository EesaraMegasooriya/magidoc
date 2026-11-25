package com.magidoc.share;

import com.magidoc.activity.ActivityService;
import com.magidoc.collection.ApiCollection;
import com.magidoc.collection.CollectionService;
import com.magidoc.common.ApiException;
import com.magidoc.security.SecurityUtils;
import com.magidoc.workspace.WorkspaceRole;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@Validated
public class ShareController {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final ShareLinkRepository shares;
    private final CollectionService collectionService;
    private final ActivityService activity;

    public record ShareLinkDto(UUID id, String token, UUID collectionId, boolean enabled, boolean active,
                               Instant expiresAt, long viewCount, Instant createdAt) {
        static ShareLinkDto from(ShareLink s) {
            return new ShareLinkDto(s.getId(), s.getToken(), s.getCollectionId(), s.isEnabled(), s.isActive(),
                    s.getExpiresAt(), s.getViewCount(), s.getCreatedAt());
        }
    }

    public record CreateShare(@Min(1) @Max(3650) Integer expiresInDays) {
    }

    public record UpdateShare(Boolean enabled) {
    }

    @GetMapping("/collections/{collectionId}/shares")
    @Transactional(readOnly = true)
    public List<ShareLinkDto> list(@PathVariable UUID collectionId) {
        collectionService.loadWithAccess(collectionId, WorkspaceRole.VIEWER);
        return shares.findByCollectionIdOrderByCreatedAtDesc(collectionId).stream().map(ShareLinkDto::from).toList();
    }

    @PostMapping("/collections/{collectionId}/shares")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public ShareLinkDto create(@PathVariable UUID collectionId,
                               @jakarta.validation.Valid @RequestBody(required = false) CreateShare req) {
        ApiCollection c = collectionService.loadWithAccess(collectionId, WorkspaceRole.EDITOR);
        ShareLink s = new ShareLink();
        s.setCollectionId(collectionId);
        s.setCreatedBy(SecurityUtils.currentUserId());
        s.setToken(newToken());
        s.setEnabled(true);
        if (req != null && req.expiresInDays() != null) {
            s.setExpiresAt(Instant.now().plus(Duration.ofDays(req.expiresInDays())));
        }
        s = shares.saveAndFlush(s);
        activity.log(c.getWorkspaceId(), SecurityUtils.currentUserId(), "published docs for", "collection",
                c.getName());
        return ShareLinkDto.from(s);
    }

    @PutMapping("/shares/{id}")
    @Transactional
    public ShareLinkDto update(@PathVariable UUID id, @RequestBody UpdateShare req) {
        ShareLink s = load(id);
        collectionService.loadWithAccess(s.getCollectionId(), WorkspaceRole.EDITOR);
        if (req.enabled() != null) s.setEnabled(req.enabled());
        return ShareLinkDto.from(shares.saveAndFlush(s));
    }

    @DeleteMapping("/shares/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void delete(@PathVariable UUID id) {
        ShareLink s = load(id);
        collectionService.loadWithAccess(s.getCollectionId(), WorkspaceRole.EDITOR);
        shares.delete(s);
    }

    private ShareLink load(UUID id) {
        return shares.findById(id).orElseThrow(() -> ApiException.notFound("Share link"));
    }

    private static String newToken() {
        byte[] bytes = new byte[24];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
