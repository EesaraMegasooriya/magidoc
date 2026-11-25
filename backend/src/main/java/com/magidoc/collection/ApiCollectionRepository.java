package com.magidoc.collection;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ApiCollectionRepository extends JpaRepository<ApiCollection, UUID> {

    List<ApiCollection> findByWorkspaceIdOrderByNameAsc(UUID workspaceId);

    long countByWorkspaceId(UUID workspaceId);
}
