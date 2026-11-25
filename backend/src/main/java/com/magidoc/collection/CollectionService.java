package com.magidoc.collection;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.magidoc.activity.ActivityService;
import com.magidoc.collection.CollectionDtos.CollectionDetail;
import com.magidoc.collection.CollectionDtos.CollectionDto;
import com.magidoc.collection.CollectionDtos.CollectionSummary;
import com.magidoc.collection.CollectionDtos.CreateCollection;
import com.magidoc.collection.CollectionDtos.CreateFolder;
import com.magidoc.collection.CollectionDtos.ExportCollection;
import com.magidoc.collection.CollectionDtos.ExportItem;
import com.magidoc.collection.CollectionDtos.FolderDto;
import com.magidoc.collection.CollectionDtos.MergeRequest;
import com.magidoc.collection.CollectionDtos.MergeResult;
import com.magidoc.collection.CollectionDtos.MoveFolder;
import com.magidoc.collection.CollectionDtos.UpdateCollection;
import com.magidoc.collection.CollectionDtos.UpdateFolder;
import com.magidoc.common.ApiException;
import com.magidoc.common.JsonSupport;
import com.magidoc.security.SecurityUtils;
import com.magidoc.workspace.WorkspaceAccessService;
import com.magidoc.workspace.WorkspaceRole;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CollectionService {

    private static final int MAX_IMPORT_DEPTH = 20;
    private static final String FORMAT_VERSION = "1.0";

    private final ApiCollectionRepository collections;
    private final FolderRepository folders;
    private final ApiRequestRepository requests;
    private final WorkspaceAccessService access;
    private final CollectionMapper mapper;
    private final JsonSupport json;
    private final ActivityService activity;

    // ---------- Access helpers (shared with other services) ----------

    @Transactional(readOnly = true)
    public ApiCollection loadWithAccess(UUID collectionId, WorkspaceRole min) {
        ApiCollection c = collections.findById(collectionId).orElseThrow(() -> ApiException.notFound("Collection"));
        access.require(c.getWorkspaceId(), min);
        return c;
    }

    // ---------- Collections ----------

    @Transactional(readOnly = true)
    public List<CollectionSummary> list(UUID workspaceId) {
        access.require(workspaceId, WorkspaceRole.VIEWER);
        List<ApiCollection> list = collections.findByWorkspaceIdOrderByNameAsc(workspaceId);
        Map<UUID, Long> counts = new HashMap<>();
        if (!list.isEmpty()) {
            for (Object[] row : requests.countGroupedByCollection(list.stream().map(ApiCollection::getId).toList())) {
                counts.put((UUID) row[0], ((Number) row[1]).longValue());
            }
        }
        return list.stream().map(c -> new CollectionSummary(c.getId(), c.getWorkspaceId(), c.getName(),
                c.getDescription() == null ? "" : c.getDescription(), counts.getOrDefault(c.getId(), 0L),
                c.getUpdatedAt())).toList();
    }

    @Transactional
    public CollectionDto create(UUID workspaceId, CreateCollection req) {
        access.require(workspaceId, WorkspaceRole.EDITOR);
        ApiCollection c = newCollection(workspaceId, req.name().trim(), req.description(), null, null);
        activity.log(workspaceId, SecurityUtils.currentUserId(), "created", "collection", c.getName());
        return mapper.toDto(c);
    }

    @Transactional(readOnly = true)
    public CollectionDetail detail(UUID collectionId) {
        ApiCollection c = loadWithAccess(collectionId, WorkspaceRole.VIEWER);
        return buildDetail(c);
    }

    @Transactional(readOnly = true)
    public CollectionDetail buildDetail(ApiCollection c) {
        List<FolderDto> fs = folders.findByCollectionIdOrderBySortOrderAscCreatedAtAsc(c.getId()).stream()
                .map(mapper::toDto).toList();
        var rs = requests.findByCollectionIdOrderBySortOrderAscCreatedAtAsc(c.getId()).stream()
                .map(mapper::toDto).toList();
        return new CollectionDetail(mapper.toDto(c), fs, rs);
    }

    @Transactional
    public CollectionDto update(UUID collectionId, UpdateCollection req) {
        ApiCollection c = loadWithAccess(collectionId, WorkspaceRole.EDITOR);
        if (req.name() != null) c.setName(req.name().trim());
        if (req.description() != null) c.setDescription(req.description());
        if (req.variables() != null) c.setVariables(json.write(requireArray(req.variables(), "variables")));
        if (req.auth() != null) c.setAuth(json.write(req.auth()));
        collections.saveAndFlush(c);
        activity.log(c.getWorkspaceId(), SecurityUtils.currentUserId(), "updated", "collection", c.getName());
        return mapper.toDto(c);
    }

    @Transactional
    public void delete(UUID collectionId) {
        ApiCollection c = loadWithAccess(collectionId, WorkspaceRole.EDITOR);
        collections.delete(c);
        activity.log(c.getWorkspaceId(), SecurityUtils.currentUserId(), "deleted", "collection", c.getName());
    }

    @Transactional
    public CollectionDto duplicate(UUID collectionId) {
        ApiCollection c = loadWithAccess(collectionId, WorkspaceRole.EDITOR);
        ExportCollection exported = export(collectionId);
        ExportCollection copy = new ExportCollection(FORMAT_VERSION, truncate(c.getName() + " Copy", 150),
                exported.description(), exported.variables(), exported.auth(), exported.items());
        return importCollection(c.getWorkspaceId(), copy);
    }

    // ---------- Import / export ----------

    @Transactional(readOnly = true)
    public ExportCollection export(UUID collectionId) {
        ApiCollection c = loadWithAccess(collectionId, WorkspaceRole.VIEWER);
        List<Folder> fs = folders.findByCollectionIdOrderBySortOrderAscCreatedAtAsc(c.getId());
        List<ApiRequest> rs = requests.findByCollectionIdOrderBySortOrderAscCreatedAtAsc(c.getId());

        Map<UUID, List<Folder>> foldersByParent = new HashMap<>();
        for (Folder f : fs) foldersByParent.computeIfAbsent(f.getParentId(), k -> new ArrayList<>()).add(f);
        Map<UUID, List<ApiRequest>> requestsByFolder = new HashMap<>();
        for (ApiRequest r : rs) requestsByFolder.computeIfAbsent(r.getFolderId(), k -> new ArrayList<>()).add(r);

        return new ExportCollection(FORMAT_VERSION, c.getName(), c.getDescription(),
                json.readArray(c.getVariables()), json.read(c.getAuth(), mapper.defaultCollectionAuth()),
                exportItems(null, foldersByParent, requestsByFolder));
    }

    private List<ExportItem> exportItems(UUID parentId, Map<UUID, List<Folder>> foldersByParent,
                                         Map<UUID, List<ApiRequest>> requestsByFolder) {
        List<ExportItem> items = new ArrayList<>();
        for (Folder f : foldersByParent.getOrDefault(parentId, List.of())) {
            items.add(new ExportItem("folder", f.getName(), f.getDescription(), null, null, null, null, null, null,
                    null, exportItems(f.getId(), foldersByParent, requestsByFolder)));
        }
        for (ApiRequest r : requestsByFolder.getOrDefault(parentId, List.of())) {
            var dto = mapper.toDto(r);
            items.add(new ExportItem("request", r.getName(), r.getDescription(), r.getMethod(), r.getUrl(),
                    dto.headers(), dto.queryParams(), dto.body(), dto.auth(), dto.examples(), null));
        }
        return items;
    }

    @Transactional
    public CollectionDto importCollection(UUID workspaceId, ExportCollection data) {
        access.require(workspaceId, WorkspaceRole.EDITOR);
        if (data == null || data.name() == null || data.name().isBlank()) {
            throw ApiException.badRequest("Collection name is required");
        }
        ApiCollection c = newCollection(workspaceId, truncate(data.name().trim(), 150), data.description(),
                data.variables() != null && data.variables().isArray() ? json.write(data.variables()) : null,
                data.auth() != null && data.auth().isObject() ? json.write(data.auth()) : null);
        importItems(c.getId(), null, data.items(), 0);
        activity.log(workspaceId, SecurityUtils.currentUserId(), "imported", "collection", c.getName());
        return mapper.toDto(c);
    }

    private void importItems(UUID collectionId, UUID parentId, List<ExportItem> items, int depth) {
        if (items == null) return;
        if (depth > MAX_IMPORT_DEPTH) throw ApiException.badRequest("Folders are nested too deeply");
        int order = 0;
        for (ExportItem item : items) {
            if (item == null) continue;
            String name = item.name() == null || item.name().isBlank() ? "Untitled" : item.name().trim();
            if ("folder".equalsIgnoreCase(item.type())) {
                Folder f = new Folder();
                f.setCollectionId(collectionId);
                f.setParentId(parentId);
                f.setName(truncate(name, 150));
                f.setDescription(item.description());
                f.setSortOrder(order++);
                f = folders.save(f);
                importItems(collectionId, f.getId(), item.items(), depth + 1);
            } else {
                requests.save(newRequest(collectionId, parentId, item, name, order++));
            }
        }
    }

    private ApiRequest newRequest(UUID collectionId, UUID folderId, ExportItem item, String name, int order) {
        ApiRequest r = new ApiRequest();
        r.setCollectionId(collectionId);
        r.setFolderId(folderId);
        r.setName(truncate(name, 200));
        r.setMethod(RequestService.normalizeMethod(item.method()));
        r.setUrl(truncate(item.url() == null ? "" : item.url(), 4000));
        r.setDescription(item.description());
        r.setHeaders(arrayOrNull(item.headers()));
        r.setQueryParams(arrayOrNull(item.queryParams()));
        r.setBody(item.body() != null && item.body().isObject() ? json.write(item.body()) : null);
        r.setAuth(item.auth() != null && item.auth().isObject() ? json.write(item.auth()) : null);
        r.setExamples(arrayOrNull(item.examples()));
        r.setSortOrder(order);
        return r;
    }

    // ---------- Merge ----------

    /** Counts what a merge changed; returned to the client for a summary. */
    private static final class MergeStats {
        int requestsAdded;
        int requestsUpdated;
        int foldersAdded;
    }

    /** Imports several collections as ONE new collection: the first is imported, the rest are merged into it. */
    @Transactional
    public MergeResult importMerged(UUID workspaceId, MergeRequest req) {
        access.require(workspaceId, WorkspaceRole.EDITOR);
        ExportCollection first = req.collections().get(0);
        String name = req.name() != null && !req.name().isBlank() ? req.name().trim() : first.name();
        CollectionDto created = importCollection(workspaceId, new ExportCollection(FORMAT_VERSION, name,
                first.description(), first.variables(), first.auth(), first.items()));
        ApiCollection c = collections.findById(created.id()).orElseThrow();
        MergeStats stats = new MergeStats();
        stats.requestsAdded = countRequests(first.items());
        stats.foldersAdded = countFolders(first.items());
        for (ExportCollection other : req.collections().subList(1, req.collections().size())) {
            mergeOne(c, other, stats);
        }
        collections.saveAndFlush(c);
        return new MergeResult(mapper.toDto(c), stats.requestsAdded, stats.requestsUpdated, stats.foldersAdded);
    }

    /**
     * Merges collections into an existing one, preserving ids of matched items (open tabs, history and
     * share links keep working). Folders match by name within the same parent; requests match by
     * method + URL (ignoring query string), falling back to method + name in the same folder.
     * Incoming request content wins; existing collection variable values are kept and new keys added.
     */
    @Transactional
    public MergeResult merge(UUID collectionId, MergeRequest req) {
        ApiCollection c = loadWithAccess(collectionId, WorkspaceRole.EDITOR);
        MergeStats stats = new MergeStats();
        for (ExportCollection in : req.collections()) mergeOne(c, in, stats);
        collections.saveAndFlush(c);
        activity.log(c.getWorkspaceId(), SecurityUtils.currentUserId(), "merged updates into", "collection", c.getName());
        return new MergeResult(mapper.toDto(c), stats.requestsAdded, stats.requestsUpdated, stats.foldersAdded);
    }

    private void mergeOne(ApiCollection c, ExportCollection in, MergeStats stats) {
        if (in == null) return;
        if ((c.getDescription() == null || c.getDescription().isBlank()) && in.description() != null && !in.description().isBlank()) {
            c.setDescription(in.description());
        }
        c.setVariables(json.write(mergeVariables(json.readArray(c.getVariables()), in.variables())));
        String existingAuthType = json.readObject(c.getAuth()).path("type").asText("none");
        if ("none".equals(existingAuthType) && in.auth() != null && in.auth().isObject()
                && !"none".equals(in.auth().path("type").asText("none"))) {
            c.setAuth(json.write(in.auth()));
        }

        List<Folder> fs = new ArrayList<>(folders.findByCollectionIdOrderBySortOrderAscCreatedAtAsc(c.getId()));
        List<ApiRequest> rs = new ArrayList<>(requests.findByCollectionIdOrderBySortOrderAscCreatedAtAsc(c.getId()));
        Map<String, ApiRequest> byEndpoint = new HashMap<>();
        for (ApiRequest r : rs) {
            String key = endpointKey(r.getMethod(), r.getUrl());
            if (key != null) byEndpoint.putIfAbsent(key, r);
        }
        mergeItems(c.getId(), null, in.items(), fs, rs, byEndpoint, stats, 0);
    }

    private void mergeItems(UUID collectionId, UUID parentId, List<ExportItem> items, List<Folder> fs,
                            List<ApiRequest> rs, Map<String, ApiRequest> byEndpoint, MergeStats stats, int depth) {
        if (items == null) return;
        if (depth > MAX_IMPORT_DEPTH) throw ApiException.badRequest("Folders are nested too deeply");
        for (ExportItem item : items) {
            if (item == null) continue;
            String name = item.name() == null || item.name().isBlank() ? "Untitled" : item.name().trim();
            if ("folder".equalsIgnoreCase(item.type())) {
                String folderName = truncate(name, 150);
                Folder folder = fs.stream()
                        .filter(f -> Objects.equals(f.getParentId(), parentId) && f.getName().equalsIgnoreCase(folderName))
                        .findFirst().orElse(null);
                if (folder == null) {
                    folder = new Folder();
                    folder.setCollectionId(collectionId);
                    folder.setParentId(parentId);
                    folder.setName(folderName);
                    folder.setDescription(item.description());
                    folder.setSortOrder((int) fs.stream().filter(f -> Objects.equals(f.getParentId(), parentId)).count());
                    folder = folders.save(folder);
                    fs.add(folder);
                    stats.foldersAdded++;
                } else if ((folder.getDescription() == null || folder.getDescription().isBlank())
                        && item.description() != null && !item.description().isBlank()) {
                    folder.setDescription(item.description());
                }
                mergeItems(collectionId, folder.getId(), item.items(), fs, rs, byEndpoint, stats, depth + 1);
            } else {
                String method = RequestService.normalizeMethod(item.method());
                String key = endpointKey(method, item.url());
                ApiRequest match = key == null ? null : byEndpoint.get(key);
                if (match == null) {
                    match = rs.stream()
                            .filter(r -> Objects.equals(r.getFolderId(), parentId) && r.getMethod().equals(method)
                                    && r.getName().equalsIgnoreCase(name))
                            .findFirst().orElse(null);
                }
                if (match != null) {
                    applyIncoming(match, item, name);
                    stats.requestsUpdated++;
                } else {
                    int order = (int) rs.stream().filter(r -> Objects.equals(r.getFolderId(), parentId)).count();
                    ApiRequest created = requests.save(newRequest(collectionId, parentId, item, name, order));
                    rs.add(created);
                    if (key != null) byEndpoint.putIfAbsent(key, created);
                    stats.requestsAdded++;
                }
            }
        }
    }

    /** Incoming content wins; empty incoming fields never wipe existing data. Examples merge by name. */
    private void applyIncoming(ApiRequest r, ExportItem item, String name) {
        r.setName(truncate(name, 200));
        if (item.url() != null && !item.url().isBlank()) r.setUrl(truncate(item.url(), 4000));
        if (item.description() != null && !item.description().isBlank()) r.setDescription(item.description());
        if (item.headers() != null && item.headers().isArray()) r.setHeaders(json.write(item.headers()));
        if (item.queryParams() != null && item.queryParams().isArray()) r.setQueryParams(json.write(item.queryParams()));
        if (item.body() != null && item.body().isObject()) r.setBody(json.write(item.body()));
        if (item.auth() != null && item.auth().isObject()) r.setAuth(json.write(item.auth()));
        if (item.examples() != null && item.examples().isArray() && !item.examples().isEmpty()) {
            ArrayNode merged = json.array();
            Set<String> incomingNames = new HashSet<>();
            for (JsonNode ex : item.examples()) incomingNames.add(ex.path("name").asText("").toLowerCase(Locale.ROOT));
            for (JsonNode ex : json.readArray(r.getExamples())) {
                if (!incomingNames.contains(ex.path("name").asText("").toLowerCase(Locale.ROOT))) merged.add(ex);
            }
            item.examples().forEach(merged::add);
            r.setExamples(json.write(merged));
        }
    }

    /** Existing values win (they are often environment-specific); new keys are appended. */
    private JsonNode mergeVariables(JsonNode existing, JsonNode incoming) {
        ArrayNode out = json.array();
        Set<String> keys = new HashSet<>();
        if (existing != null && existing.isArray()) {
            for (JsonNode v : existing) {
                out.add(v);
                keys.add(v.path("key").asText());
            }
        }
        if (incoming != null && incoming.isArray()) {
            for (JsonNode v : incoming) {
                String key = v.path("key").asText("");
                if (!key.isBlank() && keys.add(key)) out.add(v);
            }
        }
        return out;
    }

    /** "GET {{baseUrl}}/users" — query string, fragment and trailing slashes are ignored. */
    static String endpointKey(String method, String url) {
        if (url == null || url.isBlank()) return null;
        String u = url.trim();
        int cut = u.length();
        int q = u.indexOf('?');
        int h = u.indexOf('#');
        if (q >= 0) cut = Math.min(cut, q);
        if (h >= 0) cut = Math.min(cut, h);
        u = u.substring(0, cut).replaceAll("/+$", "");
        return u.isEmpty() ? null : method + " " + u;
    }

    private static int countRequests(List<ExportItem> items) {
        if (items == null) return 0;
        return items.stream().filter(Objects::nonNull)
                .mapToInt(i -> "folder".equalsIgnoreCase(i.type()) ? countRequests(i.items()) : 1).sum();
    }

    private static int countFolders(List<ExportItem> items) {
        if (items == null) return 0;
        return items.stream().filter(i -> i != null && "folder".equalsIgnoreCase(i.type()))
                .mapToInt(i -> 1 + countFolders(i.items())).sum();
    }

    // ---------- Folders ----------

    @Transactional
    public FolderDto createFolder(UUID collectionId, CreateFolder req) {
        ApiCollection c = loadWithAccess(collectionId, WorkspaceRole.EDITOR);
        if (req.parentId() != null) loadFolderIn(c.getId(), req.parentId());
        Folder f = new Folder();
        f.setCollectionId(c.getId());
        f.setParentId(req.parentId());
        f.setName(req.name().trim());
        f.setDescription(req.description());
        f.setSortOrder((int) folders.countByCollectionId(c.getId()));
        f = folders.saveAndFlush(f);
        activity.log(c.getWorkspaceId(), SecurityUtils.currentUserId(), "created", "folder", f.getName());
        return mapper.toDto(f);
    }

    @Transactional
    public FolderDto updateFolder(UUID folderId, UpdateFolder req) {
        Folder f = loadFolderWithAccess(folderId, WorkspaceRole.EDITOR);
        if (req.name() != null) f.setName(req.name().trim());
        if (req.description() != null) f.setDescription(req.description());
        return mapper.toDto(folders.saveAndFlush(f));
    }

    @Transactional
    public FolderDto moveFolder(UUID folderId, MoveFolder req) {
        Folder f = loadFolderWithAccess(folderId, WorkspaceRole.EDITOR);
        if (req.parentId() != null) {
            loadFolderIn(f.getCollectionId(), req.parentId());
            assertNoCycle(f.getId(), req.parentId());
        }
        f.setParentId(req.parentId());
        if (req.sortOrder() != null) f.setSortOrder(req.sortOrder());
        return mapper.toDto(folders.saveAndFlush(f));
    }

    @Transactional
    public void deleteFolder(UUID folderId) {
        Folder f = loadFolderWithAccess(folderId, WorkspaceRole.EDITOR);
        ApiCollection c = collections.findById(f.getCollectionId()).orElseThrow();
        folders.delete(f);
        activity.log(c.getWorkspaceId(), SecurityUtils.currentUserId(), "deleted", "folder", f.getName());
    }

    Folder loadFolderIn(UUID collectionId, UUID folderId) {
        return folders.findById(folderId)
                .filter(f -> f.getCollectionId().equals(collectionId))
                .orElseThrow(() -> ApiException.badRequest("Folder does not belong to this collection"));
    }

    private Folder loadFolderWithAccess(UUID folderId, WorkspaceRole min) {
        Folder f = folders.findById(folderId).orElseThrow(() -> ApiException.notFound("Folder"));
        loadWithAccess(f.getCollectionId(), min);
        return f;
    }

    private void assertNoCycle(UUID folderId, UUID newParentId) {
        Set<UUID> seen = new HashSet<>();
        UUID cursor = newParentId;
        while (cursor != null) {
            if (cursor.equals(folderId)) throw ApiException.badRequest("A folder can't be moved into itself");
            if (!seen.add(cursor)) break;
            cursor = folders.findById(cursor).map(Folder::getParentId).orElse(null);
        }
    }

    // ---------- helpers ----------

    private ApiCollection newCollection(UUID workspaceId, String name, String description, String variables,
                                        String auth) {
        ApiCollection c = new ApiCollection();
        c.setWorkspaceId(workspaceId);
        c.setName(name);
        c.setDescription(description);
        c.setVariables(variables == null ? "[]" : variables);
        c.setAuth(auth);
        c.setCreatedBy(SecurityUtils.currentUserIdOrNull());
        return collections.saveAndFlush(c);
    }

    private String arrayOrNull(com.fasterxml.jackson.databind.JsonNode node) {
        return node != null && node.isArray() ? json.write(node) : null;
    }

    private static com.fasterxml.jackson.databind.JsonNode requireArray(com.fasterxml.jackson.databind.JsonNode n,
                                                                        String field) {
        if (!n.isArray()) throw ApiException.badRequest(field + " must be an array");
        return n;
    }

    static String truncate(String s, int max) {
        return Objects.requireNonNullElse(s, "").length() > max ? s.substring(0, max) : Objects.requireNonNullElse(s, "");
    }
}
