package com.magidoc.collection;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface ApiRequestRepository extends JpaRepository<ApiRequest, UUID> {

    List<ApiRequest> findByCollectionIdOrderBySortOrderAscCreatedAtAsc(UUID collectionId);

    long countByCollectionId(UUID collectionId);

    @Query("select r.collectionId, count(r) from ApiRequest r where r.collectionId in :ids group by r.collectionId")
    List<Object[]> countGroupedByCollection(@Param("ids") Collection<UUID> ids);
}
