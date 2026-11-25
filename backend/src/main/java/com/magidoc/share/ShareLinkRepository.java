package com.magidoc.share;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ShareLinkRepository extends JpaRepository<ShareLink, UUID> {

    Optional<ShareLink> findByToken(String token);

    List<ShareLink> findByCollectionIdOrderByCreatedAtDesc(UUID collectionId);

    @Modifying
    @Query("update ShareLink s set s.viewCount = s.viewCount + 1 where s.id = :id")
    void incrementViews(@Param("id") UUID id);
}
