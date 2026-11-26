package com.magidoc.share;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.magidoc.collection.ApiCollection;
import com.magidoc.collection.ApiCollectionRepository;
import com.magidoc.collection.CollectionDtos.CollectionDetail;
import com.magidoc.collection.CollectionDtos.CollectionDto;
import com.magidoc.collection.CollectionDtos.RequestDto;
import com.magidoc.collection.CollectionService;
import com.magidoc.common.ApiException;
import com.magidoc.common.JsonSupport;
import com.magidoc.workspace.Workspace;
import com.magidoc.workspace.WorkspaceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.regex.Pattern;

/** Read-only, unauthenticated access to published collection docs. Secrets are stripped. */
@RestController
@RequiredArgsConstructor
public class PublicDocsController {

    private static final Pattern SENSITIVE_HEADER =
            Pattern.compile("(?i).*(authorization|api[-_]?key|token|secret|cookie|password).*");
    private static final String MASK = "••••••";

    private final ShareLinkRepository shares;
    private final ApiCollectionRepository collections;
    private final WorkspaceRepository workspaces;
    private final CollectionService collectionService;
    private final JsonSupport json;

    public record PublicDocs(String workspaceName, CollectionDetail detail) {
    }

    @GetMapping("/api/public/docs/{token}")
    @Transactional
    public PublicDocs get(@PathVariable String token) {
        ShareLink link = shares.findByToken(token).filter(ShareLink::isActive)
                .orElseThrow(() -> ApiException.notFound("Documentation"));
        ApiCollection c = collections.findById(link.getCollectionId())
                .orElseThrow(() -> ApiException.notFound("Documentation"));
        shares.incrementViews(link.getId());

        CollectionDetail raw = collectionService.buildDetail(c);
        CollectionDto col = raw.collection();
        CollectionDto safeCollection = new CollectionDto(col.id(), null, col.name(), col.description(),
                maskVariables(col.variables()), sanitizeAuth(col.auth()), col.createdAt(), col.updatedAt());
        List<RequestDto> safeRequests = raw.requests().stream().map(r -> new RequestDto(r.id(), r.collectionId(),
                r.folderId(), r.name(), r.method(), r.url(), r.description(), maskHeaders(r.headers()),
                r.queryParams(), r.body(), sanitizeAuth(r.auth()), r.examples(), r.sortOrder(), r.updatedAt(), null))
                .toList();

        String wsName = workspaces.findById(c.getWorkspaceId()).map(Workspace::getName).orElse("");
        return new PublicDocs(wsName, new CollectionDetail(safeCollection, raw.folders(), safeRequests));
    }

    private JsonNode maskVariables(JsonNode vars) {
        ArrayNode out = json.array();
        if (vars != null && vars.isArray()) {
            for (JsonNode v : vars) {
                if (!v.isObject()) continue;
                ObjectNode copy = ((ObjectNode) v).deepCopy();
                if (copy.path("secret").asBoolean(false)) copy.put("value", MASK);
                out.add(copy);
            }
        }
        return out;
    }

    private JsonNode maskHeaders(JsonNode headers) {
        ArrayNode out = json.array();
        if (headers != null && headers.isArray()) {
            for (JsonNode h : headers) {
                if (!h.isObject()) continue;
                ObjectNode copy = ((ObjectNode) h).deepCopy();
                String key = copy.path("key").asText("");
                String value = copy.path("value").asText("");
                if (SENSITIVE_HEADER.matcher(key).matches() && !value.matches("^\\{\\{[^}]+}}$")) {
                    copy.put("value", MASK);
                }
                out.add(copy);
            }
        }
        return out;
    }

    /** Keep only the auth type (and non-secret location info) so readers know what's required. */
    private JsonNode sanitizeAuth(JsonNode auth) {
        ObjectNode out = json.object();
        if (auth == null || !auth.isObject()) {
            out.put("type", "none");
            return out;
        }
        out.put("type", auth.path("type").asText("none"));
        if (auth.has("key")) out.put("key", auth.path("key").asText());
        if (auth.has("in")) out.put("in", auth.path("in").asText());
        return out;
    }
}
