package com.magidoc.collection;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class CollectionDtos {

    private CollectionDtos() {
    }

    public record CollectionSummary(UUID id, UUID workspaceId, String name, String description,
                                    long requestCount, Instant updatedAt) {
    }

    public record CollectionDto(UUID id, UUID workspaceId, String name, String description, JsonNode variables,
                                JsonNode auth, Instant createdAt, Instant updatedAt) {
    }

    public record FolderDto(UUID id, UUID collectionId, UUID parentId, String name, String description,
                            int sortOrder, Instant updatedAt) {
    }

    public record RequestDto(UUID id, UUID collectionId, UUID folderId, String name, String method, String url,
                             String description, JsonNode headers, JsonNode queryParams, JsonNode body,
                             JsonNode auth, JsonNode examples, int sortOrder, Instant updatedAt) {
    }

    public record CollectionDetail(CollectionDto collection, List<FolderDto> folders, List<RequestDto> requests) {
    }

    public record CreateCollection(@NotBlank @Size(max = 150) String name, String description) {
    }

    public record UpdateCollection(@Size(min = 1, max = 150) String name, String description,
                                   JsonNode variables, JsonNode auth) {
    }

    public record CreateFolder(@NotBlank @Size(max = 150) String name, UUID parentId, String description) {
    }

    public record UpdateFolder(@Size(min = 1, max = 150) String name, String description) {
    }

    public record MoveFolder(UUID parentId, Integer sortOrder) {
    }

    public record CreateApiRequest(@NotBlank @Size(max = 200) String name, UUID folderId, String method,
                                   @Size(max = 4000) String url, String description, JsonNode headers,
                                   JsonNode queryParams, JsonNode body, JsonNode auth) {
    }

    public record UpdateApiRequest(@Size(min = 1, max = 200) String name, String method,
                                   @Size(max = 4000) String url, String description, JsonNode headers,
                                   JsonNode queryParams, JsonNode body, JsonNode auth, JsonNode examples) {
    }

    public record MoveApiRequest(UUID folderId, Integer sortOrder) {
    }

    /** One or more collections to import as a single collection, or to merge into an existing one. */
    public record MergeRequest(@NotEmpty @Size(max = 20) @Valid List<ExportCollection> collections,
                               @Size(max = 150) String name) {
    }

    public record MergeResult(CollectionDto collection, int requestsAdded, int requestsUpdated, int foldersAdded) {
    }

    /** Outcome of turning "Folder/Name" names into real folders inside an existing collection. */
    public record OrganizeResult(int foldersMoved, int foldersMerged, int foldersCreated, int requestsMoved) {
        public boolean changed() {
            return foldersMoved + foldersMerged + foldersCreated + requestsMoved > 0;
        }
    }

    /** Portable, nested export format ("MagiDoc collection v1"). */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record ExportCollection(String magidoc, @NotBlank @Size(max = 150) String name, String description,
                                   JsonNode variables, JsonNode auth, @Valid List<ExportItem> items) {
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record ExportItem(String type, String name, String description, String method, String url,
                             JsonNode headers, JsonNode queryParams, JsonNode body, JsonNode auth,
                             JsonNode examples, List<ExportItem> items) {
    }
}
