package com.magidoc.collection;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface FolderRepository extends JpaRepository<Folder, UUID> {

    List<Folder> findByCollectionIdOrderBySortOrderAscCreatedAtAsc(UUID collectionId);

    long countByCollectionId(UUID collectionId);
}
