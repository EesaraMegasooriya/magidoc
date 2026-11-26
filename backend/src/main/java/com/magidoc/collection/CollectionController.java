package com.magidoc.collection;

import com.magidoc.collection.CollectionDtos.CollectionDetail;
import com.magidoc.collection.CollectionDtos.CollectionDto;
import com.magidoc.collection.CollectionDtos.CollectionSummary;
import com.magidoc.collection.CollectionDtos.CreateApiRequest;
import com.magidoc.collection.CollectionDtos.CreateCollection;
import com.magidoc.collection.CollectionDtos.CreateFolder;
import com.magidoc.collection.CollectionDtos.ExportCollection;
import com.magidoc.collection.CollectionDtos.FolderDto;
import com.magidoc.collection.CollectionDtos.MergeRequest;
import com.magidoc.collection.CollectionDtos.MergeResult;
import com.magidoc.collection.CollectionDtos.SetIntegrationStatus;
import com.magidoc.collection.CollectionDtos.OrganizeResult;
import com.magidoc.collection.CollectionDtos.MoveApiRequest;
import com.magidoc.collection.CollectionDtos.MoveFolder;
import com.magidoc.collection.CollectionDtos.RequestDto;
import com.magidoc.collection.CollectionDtos.UpdateApiRequest;
import com.magidoc.collection.CollectionDtos.UpdateCollection;
import com.magidoc.collection.CollectionDtos.UpdateFolder;
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
@RequestMapping("/api")
@RequiredArgsConstructor
public class CollectionController {

    private final CollectionService collectionService;
    private final RequestService requestService;

    // ---- Collections ----

    @GetMapping("/workspaces/{workspaceId}/collections")
    public List<CollectionSummary> list(@PathVariable UUID workspaceId) {
        return collectionService.list(workspaceId);
    }

    @PostMapping("/workspaces/{workspaceId}/collections")
    @ResponseStatus(HttpStatus.CREATED)
    public CollectionDto create(@PathVariable UUID workspaceId, @Valid @RequestBody CreateCollection req) {
        return collectionService.create(workspaceId, req);
    }

    @PostMapping("/workspaces/{workspaceId}/collections/import")
    @ResponseStatus(HttpStatus.CREATED)
    public CollectionDto importCollection(@PathVariable UUID workspaceId, @Valid @RequestBody ExportCollection req) {
        return collectionService.importCollection(workspaceId, req);
    }

    /** Imports several files as one collection, auto-merging duplicates. */
    @PostMapping("/workspaces/{workspaceId}/collections/import-merged")
    @ResponseStatus(HttpStatus.CREATED)
    public MergeResult importMerged(@PathVariable UUID workspaceId, @Valid @RequestBody MergeRequest req) {
        return collectionService.importMerged(workspaceId, req);
    }

    /** Merges imported collections into an existing collection. */
    @PostMapping("/collections/{id}/merge")
    public MergeResult merge(@PathVariable UUID id, @Valid @RequestBody MergeRequest req) {
        return collectionService.merge(id, req);
    }

    /** Turns "Folder/Name" style names into real (nested) folders, in place. */
    @PostMapping("/collections/{id}/organize-folder-paths")
    public OrganizeResult organizeFolderPaths(@PathVariable UUID id) {
        return collectionService.organizeFolderPaths(id);
    }

    @GetMapping("/collections/{id}")
    public CollectionDetail detail(@PathVariable UUID id) {
        return collectionService.detail(id);
    }

    @PutMapping("/collections/{id}")
    public CollectionDto update(@PathVariable UUID id, @Valid @RequestBody UpdateCollection req) {
        return collectionService.update(id, req);
    }

    @DeleteMapping("/collections/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        collectionService.delete(id);
    }

    @PostMapping("/collections/{id}/duplicate")
    @ResponseStatus(HttpStatus.CREATED)
    public CollectionDto duplicate(@PathVariable UUID id) {
        return collectionService.duplicate(id);
    }

    @GetMapping("/collections/{id}/export")
    public ExportCollection export(@PathVariable UUID id) {
        return collectionService.export(id);
    }

    // ---- Folders ----

    @PostMapping("/collections/{collectionId}/folders")
    @ResponseStatus(HttpStatus.CREATED)
    public FolderDto createFolder(@PathVariable UUID collectionId, @Valid @RequestBody CreateFolder req) {
        return collectionService.createFolder(collectionId, req);
    }

    @PutMapping("/folders/{id}")
    public FolderDto updateFolder(@PathVariable UUID id, @Valid @RequestBody UpdateFolder req) {
        return collectionService.updateFolder(id, req);
    }

    @PutMapping("/folders/{id}/move")
    public FolderDto moveFolder(@PathVariable UUID id, @RequestBody MoveFolder req) {
        return collectionService.moveFolder(id, req);
    }

    @DeleteMapping("/folders/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteFolder(@PathVariable UUID id) {
        collectionService.deleteFolder(id);
    }

    // ---- Requests ----

    @PostMapping("/collections/{collectionId}/requests")
    @ResponseStatus(HttpStatus.CREATED)
    public RequestDto createRequest(@PathVariable UUID collectionId, @Valid @RequestBody CreateApiRequest req) {
        return requestService.create(collectionId, req);
    }

    @GetMapping("/requests/{id}")
    public RequestDto getRequest(@PathVariable UUID id) {
        return requestService.get(id);
    }

    @PutMapping("/requests/{id}")
    public RequestDto updateRequest(@PathVariable UUID id, @Valid @RequestBody UpdateApiRequest req) {
        return requestService.update(id, req);
    }

    @PutMapping("/requests/{id}/move")
    public RequestDto moveRequest(@PathVariable UUID id, @RequestBody MoveApiRequest req) {
        return requestService.move(id, req);
    }

    @PutMapping("/requests/{id}/integration-status")
    public RequestDto setIntegrationStatus(@PathVariable UUID id, @RequestBody SetIntegrationStatus req) {
        return requestService.setIntegrationStatus(id, req);
    }

    @PostMapping("/requests/{id}/duplicate")
    @ResponseStatus(HttpStatus.CREATED)
    public RequestDto duplicateRequest(@PathVariable UUID id) {
        return requestService.duplicate(id);
    }

    @DeleteMapping("/requests/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteRequest(@PathVariable UUID id) {
        requestService.delete(id);
    }
}
