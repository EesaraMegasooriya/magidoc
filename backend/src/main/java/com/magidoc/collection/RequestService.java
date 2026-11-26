package com.magidoc.collection;

import com.fasterxml.jackson.databind.JsonNode;
import com.magidoc.activity.ActivityService;
import com.magidoc.collection.CollectionDtos.CreateApiRequest;
import com.magidoc.collection.CollectionDtos.MoveApiRequest;
import com.magidoc.collection.CollectionDtos.RequestDto;
import com.magidoc.collection.CollectionDtos.SetIntegrationStatus;
import com.magidoc.collection.CollectionDtos.UpdateApiRequest;
import com.magidoc.common.ApiException;
import com.magidoc.common.JsonSupport;
import com.magidoc.security.SecurityUtils;
import com.magidoc.workspace.WorkspaceRole;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RequestService {

    public static final Set<String> METHODS = Set.of("GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS");

    private final ApiRequestRepository requests;
    private final CollectionService collectionService;
    private final CollectionMapper mapper;
    private final JsonSupport json;
    private final ActivityService activity;

    public static String normalizeMethod(String method) {
        String m = method == null ? "GET" : method.trim().toUpperCase(Locale.ROOT);
        return METHODS.contains(m) ? m : "GET";
    }

    @Transactional(readOnly = true)
    public RequestDto get(UUID id) {
        ApiRequest r = load(id);
        collectionService.loadWithAccess(r.getCollectionId(), WorkspaceRole.VIEWER);
        return mapper.toDto(r);
    }

    @Transactional
    public RequestDto create(UUID collectionId, CreateApiRequest req) {
        ApiCollection c = collectionService.loadWithAccess(collectionId, WorkspaceRole.EDITOR);
        if (req.folderId() != null) collectionService.loadFolderIn(c.getId(), req.folderId());
        validateMethod(req.method());

        ApiRequest r = new ApiRequest();
        r.setCollectionId(c.getId());
        r.setFolderId(req.folderId());
        r.setName(req.name().trim());
        r.setMethod(normalizeMethod(req.method()));
        r.setUrl(req.url() == null ? "" : req.url());
        r.setDescription(req.description());
        r.setHeaders(writeArray(req.headers(), "headers"));
        r.setQueryParams(writeArray(req.queryParams(), "queryParams"));
        r.setBody(writeObject(req.body(), "body"));
        r.setAuth(writeObject(req.auth(), "auth"));
        r.setExamples("[]");
        r.setSortOrder((int) requests.countByCollectionId(c.getId()));
        r = requests.saveAndFlush(r);
        activity.log(c.getWorkspaceId(), SecurityUtils.currentUserId(), "created", "request", r.getName());
        return mapper.toDto(r);
    }

    @Transactional
    public RequestDto update(UUID id, UpdateApiRequest req) {
        ApiRequest r = load(id);
        ApiCollection c = collectionService.loadWithAccess(r.getCollectionId(), WorkspaceRole.EDITOR);
        validateMethod(req.method());
        if (req.name() != null) r.setName(req.name().trim());
        if (req.method() != null) r.setMethod(normalizeMethod(req.method()));
        if (req.url() != null) r.setUrl(req.url());
        if (req.description() != null) r.setDescription(req.description());
        if (req.headers() != null) r.setHeaders(writeArray(req.headers(), "headers"));
        if (req.queryParams() != null) r.setQueryParams(writeArray(req.queryParams(), "queryParams"));
        if (req.body() != null) r.setBody(writeObject(req.body(), "body"));
        if (req.auth() != null) r.setAuth(writeObject(req.auth(), "auth"));
        if (req.examples() != null) r.setExamples(writeArray(req.examples(), "examples"));
        r = requests.saveAndFlush(r);
        activity.log(c.getWorkspaceId(), SecurityUtils.currentUserId(), "updated", "request", r.getName());
        return mapper.toDto(r);
    }

    @Transactional
    public RequestDto move(UUID id, MoveApiRequest req) {
        ApiRequest r = load(id);
        collectionService.loadWithAccess(r.getCollectionId(), WorkspaceRole.EDITOR);
        if (req.folderId() != null) collectionService.loadFolderIn(r.getCollectionId(), req.folderId());
        r.setFolderId(req.folderId());
        if (req.sortOrder() != null) r.setSortOrder(req.sortOrder());
        return mapper.toDto(requests.saveAndFlush(r));
    }

    /** Separate from update() so marking a status never overwrites someone's unsaved edits to the request. */
    @Transactional
    public RequestDto setIntegrationStatus(UUID id, SetIntegrationStatus req) {
        ApiRequest r = load(id);
        ApiCollection c = collectionService.loadWithAccess(r.getCollectionId(), WorkspaceRole.EDITOR);
        IntegrationStatus status = IntegrationStatus.parseStrict(req == null ? null : req.status());
        if (status == r.getIntegrationStatus()) return mapper.toDto(r);
        r.setIntegrationStatus(status);
        r = requests.saveAndFlush(r);
        activity.log(c.getWorkspaceId(), SecurityUtils.currentUserId(), "updated status of", "request",
                r.getName() + " → " + (status == null ? "not marked" : status.label()));
        return mapper.toDto(r);
    }

    @Transactional
    public RequestDto duplicate(UUID id) {
        ApiRequest src = load(id);
        ApiCollection c = collectionService.loadWithAccess(src.getCollectionId(), WorkspaceRole.EDITOR);
        ApiRequest r = new ApiRequest();
        r.setCollectionId(src.getCollectionId());
        r.setFolderId(src.getFolderId());
        r.setName(CollectionService.truncate(src.getName() + " Copy", 200));
        r.setMethod(src.getMethod());
        r.setUrl(src.getUrl());
        r.setDescription(src.getDescription());
        r.setHeaders(src.getHeaders());
        r.setQueryParams(src.getQueryParams());
        r.setBody(src.getBody());
        r.setAuth(src.getAuth());
        r.setExamples(src.getExamples());
        r.setIntegrationStatus(src.getIntegrationStatus());
        r.setSortOrder(src.getSortOrder() + 1);
        r = requests.saveAndFlush(r);
        activity.log(c.getWorkspaceId(), SecurityUtils.currentUserId(), "duplicated", "request", src.getName());
        return mapper.toDto(r);
    }

    @Transactional
    public void delete(UUID id) {
        ApiRequest r = load(id);
        ApiCollection c = collectionService.loadWithAccess(r.getCollectionId(), WorkspaceRole.EDITOR);
        requests.delete(r);
        activity.log(c.getWorkspaceId(), SecurityUtils.currentUserId(), "deleted", "request", r.getName());
    }

    private ApiRequest load(UUID id) {
        return requests.findById(id).orElseThrow(() -> ApiException.notFound("Request"));
    }

    private static void validateMethod(String method) {
        if (method != null && !METHODS.contains(method.trim().toUpperCase(Locale.ROOT))) {
            throw ApiException.badRequest("Unsupported HTTP method: " + method);
        }
    }

    private String writeArray(JsonNode node, String field) {
        if (node == null) return "[]";
        if (!node.isArray()) throw ApiException.badRequest(field + " must be an array");
        return json.write(node);
    }

    private String writeObject(JsonNode node, String field) {
        if (node == null) return null;
        if (!node.isObject()) throw ApiException.badRequest(field + " must be an object");
        return json.write(node);
    }
}
