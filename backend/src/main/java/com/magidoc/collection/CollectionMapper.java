package com.magidoc.collection;

import com.magidoc.collection.CollectionDtos.CollectionDto;
import com.magidoc.collection.CollectionDtos.FolderDto;
import com.magidoc.collection.CollectionDtos.RequestDto;
import com.magidoc.common.JsonSupport;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class CollectionMapper {

    private final JsonSupport json;

    public CollectionDto toDto(ApiCollection c) {
        return new CollectionDto(c.getId(), c.getWorkspaceId(), c.getName(), nz(c.getDescription()),
                json.readArray(c.getVariables()), json.read(c.getAuth(), defaultCollectionAuth()),
                c.getCreatedAt(), c.getUpdatedAt());
    }

    public FolderDto toDto(Folder f) {
        return new FolderDto(f.getId(), f.getCollectionId(), f.getParentId(), f.getName(), nz(f.getDescription()),
                f.getSortOrder(), f.getUpdatedAt());
    }

    public RequestDto toDto(ApiRequest r) {
        return new RequestDto(r.getId(), r.getCollectionId(), r.getFolderId(), r.getName(), r.getMethod(), r.getUrl(),
                nz(r.getDescription()), json.readArray(r.getHeaders()), json.readArray(r.getQueryParams()),
                json.read(r.getBody(), defaultBody()), json.read(r.getAuth(), defaultRequestAuth()),
                json.readArray(r.getExamples()), r.getSortOrder(), r.getUpdatedAt());
    }

    public com.fasterxml.jackson.databind.node.ObjectNode defaultBody() {
        var n = json.object();
        n.put("mode", "none");
        n.put("raw", "");
        n.set("fields", json.array());
        return n;
    }

    public com.fasterxml.jackson.databind.node.ObjectNode defaultRequestAuth() {
        var n = json.object();
        n.put("type", "inherit");
        return n;
    }

    public com.fasterxml.jackson.databind.node.ObjectNode defaultCollectionAuth() {
        var n = json.object();
        n.put("type", "none");
        return n;
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }
}
