package com.magidoc.snippet;

import com.magidoc.activity.ActivityService;
import com.magidoc.common.ApiException;
import com.magidoc.security.SecurityUtils;
import com.magidoc.user.User;
import com.magidoc.user.UserRepository;
import com.magidoc.workspace.WorkspaceAccessService;
import com.magidoc.workspace.WorkspaceRole;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
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

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Stream;

/** Text space: notes and code snippets shared with everyone in a workspace. */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class SnippetController {

    private static final String TARGET = "text";
    private static final int MAX_CONTENT = 200_000;
    private static final int PREVIEW_LENGTH = 160;
    private static final int MAX_RESULTS = 500;
    private static final String LANGUAGE_PATTERN = "^[a-z0-9+#.-]{1,30}$";

    private final SnippetRepository snippets;
    private final WorkspaceAccessService access;
    private final UserRepository users;
    private final ActivityService activity;

    public record Person(UUID id, String name, String avatarColor) {
    }

    public record SnippetSummary(UUID id, String title, Snippet.Kind kind, String language, boolean pinned,
                                 String preview, Person createdBy, Person updatedBy, Instant updatedAt, long version) {
    }

    public record SnippetDto(UUID id, UUID workspaceId, String title, Snippet.Kind kind, String language,
                             String content, boolean pinned, Person createdBy, Person updatedBy, Instant createdAt,
                             Instant updatedAt, long version, boolean canDelete) {
    }

    public record CreateSnippet(@NotBlank @Size(max = 200) String title, @NotNull Snippet.Kind kind,
                                @Pattern(regexp = LANGUAGE_PATTERN) String language,
                                @Size(max = MAX_CONTENT) String content) {
    }

    /** {@code version} must be the version the client last saw; a mismatch means someone else saved first. */
    public record UpdateSnippet(@Size(min = 1, max = 200) String title, Snippet.Kind kind,
                                @Pattern(regexp = LANGUAGE_PATTERN) String language,
                                @Size(max = MAX_CONTENT) String content, @NotNull Long version) {
    }

    public record PinSnippet(@NotNull Boolean pinned) {
    }

    @GetMapping("/workspaces/{workspaceId}/snippets")
    @Transactional(readOnly = true)
    public List<SnippetSummary> list(@PathVariable UUID workspaceId, @RequestParam(required = false) String q) {
        access.require(workspaceId, WorkspaceRole.VIEWER);
        PageRequest page = PageRequest.of(0, MAX_RESULTS);
        List<Snippet> list = q == null || q.isBlank()
                ? snippets.findAllInWorkspace(workspaceId, page)
                : snippets.search(workspaceId, "%" + escapeLike(q.trim().toLowerCase(Locale.ROOT)) + "%", page);
        Map<UUID, User> people = users.mapByIds(list.stream()
                .flatMap(s -> Stream.of(s.getCreatedBy(), s.getUpdatedBy())).filter(Objects::nonNull).distinct().toList());
        return list.stream().map(s -> new SnippetSummary(s.getId(), s.getTitle(), s.getKind(), s.getLanguage(),
                s.isPinned(), preview(s.getContent()), person(people, s.getCreatedBy()),
                person(people, s.getUpdatedBy()), s.getUpdatedAt(), s.getVersion())).toList();
    }

    @GetMapping("/snippets/{id}")
    @Transactional(readOnly = true)
    public SnippetDto get(@PathVariable UUID id) {
        Snippet s = load(id);
        WorkspaceRole role = access.require(s.getWorkspaceId(), WorkspaceRole.VIEWER);
        return toDto(s, role);
    }

    @PostMapping("/workspaces/{workspaceId}/snippets")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public SnippetDto create(@PathVariable UUID workspaceId, @Valid @RequestBody CreateSnippet req) {
        WorkspaceRole role = access.require(workspaceId, WorkspaceRole.EDITOR);
        UUID me = SecurityUtils.currentUserId();
        Snippet s = new Snippet();
        s.setWorkspaceId(workspaceId);
        s.setTitle(req.title().trim());
        s.setKind(req.kind());
        s.setLanguage(req.kind() == Snippet.Kind.CODE ? defaultLanguage(req.language()) : null);
        s.setContent(req.content() == null ? "" : req.content());
        s.setCreatedBy(me);
        s.setUpdatedBy(me);
        s = snippets.saveAndFlush(s);
        activity.log(workspaceId, me, "shared", TARGET, s.getTitle());
        return toDto(s, role);
    }

    @PutMapping("/snippets/{id}")
    @Transactional
    public SnippetDto update(@PathVariable UUID id, @Valid @RequestBody UpdateSnippet req) {
        Snippet s = load(id);
        WorkspaceRole role = access.require(s.getWorkspaceId(), WorkspaceRole.EDITOR);
        if (req.version() != s.getVersion()) {
            throw ApiException.conflict("Someone else saved changes to this text. Reload to see them, or overwrite with yours.");
        }
        if (req.title() != null) s.setTitle(req.title().trim());
        if (req.kind() != null) s.setKind(req.kind());
        if (req.language() != null) s.setLanguage(req.language());
        s.setLanguage(s.getKind() == Snippet.Kind.CODE ? defaultLanguage(s.getLanguage()) : null);
        if (req.content() != null) s.setContent(req.content());
        s.setUpdatedBy(SecurityUtils.currentUserId());
        s = snippets.saveAndFlush(s);
        activity.log(s.getWorkspaceId(), SecurityUtils.currentUserId(), "edited", TARGET, s.getTitle());
        return toDto(s, role);
    }

    /** Pin/unpin without a version check (pinning never conflicts with edits). */
    @PutMapping("/snippets/{id}/pin")
    @Transactional
    public SnippetDto pin(@PathVariable UUID id, @Valid @RequestBody PinSnippet req) {
        Snippet s = load(id);
        WorkspaceRole role = access.require(s.getWorkspaceId(), WorkspaceRole.EDITOR);
        s.setPinned(req.pinned());
        return toDto(snippets.saveAndFlush(s), role);
    }

    /** Authors can delete their own texts; admins can delete any. */
    @DeleteMapping("/snippets/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void delete(@PathVariable UUID id) {
        Snippet s = load(id);
        WorkspaceRole role = access.require(s.getWorkspaceId(), WorkspaceRole.EDITOR);
        if (!canDelete(s, role)) {
            throw ApiException.forbidden("Only the author or a workspace admin can delete this text");
        }
        snippets.delete(s);
        activity.log(s.getWorkspaceId(), SecurityUtils.currentUserId(), "deleted", TARGET, s.getTitle());
    }

    private static String defaultLanguage(String language) {
        return language == null || language.isBlank() ? "plaintext" : language;
    }

    private static boolean canDelete(Snippet s, WorkspaceRole role) {
        return role.atLeast(WorkspaceRole.ADMIN)
                || (role.atLeast(WorkspaceRole.EDITOR) && SecurityUtils.currentUserId().equals(s.getCreatedBy()));
    }

    private Snippet load(UUID id) {
        return snippets.findById(id).orElseThrow(() -> ApiException.notFound("Text"));
    }

    private SnippetDto toDto(Snippet s, WorkspaceRole role) {
        Map<UUID, User> people = users.mapByIds(Stream.of(s.getCreatedBy(), s.getUpdatedBy())
                .filter(Objects::nonNull).distinct().toList());
        return new SnippetDto(s.getId(), s.getWorkspaceId(), s.getTitle(), s.getKind(), s.getLanguage(), s.getContent(),
                s.isPinned(), person(people, s.getCreatedBy()), person(people, s.getUpdatedBy()), s.getCreatedAt(),
                s.getUpdatedAt(), s.getVersion(), canDelete(s, role));
    }

    private static Person person(Map<UUID, User> people, UUID id) {
        User u = id == null ? null : people.get(id);
        return u == null ? null : new Person(u.getId(), u.getName(), u.getAvatarColor());
    }

    private static String preview(String content) {
        if (content == null) return "";
        String flat = content.replaceAll("\\s+", " ").trim();
        return flat.length() > PREVIEW_LENGTH ? flat.substring(0, PREVIEW_LENGTH) + "…" : flat;
    }

    /** Treat % and _ typed by users literally. */
    private static String escapeLike(String s) {
        return s.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
