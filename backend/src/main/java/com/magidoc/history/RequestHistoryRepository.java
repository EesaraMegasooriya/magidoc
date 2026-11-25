package com.magidoc.history;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface RequestHistoryRepository extends JpaRepository<RequestHistory, UUID> {

    List<RequestHistory> findByWorkspaceIdAndUserIdOrderByCreatedAtDesc(UUID workspaceId, UUID userId,
                                                                        Pageable pageable);

    @Modifying
    @Query("delete from RequestHistory h where h.workspaceId = :workspaceId and h.userId = :userId")
    void deleteAllForUser(@Param("workspaceId") UUID workspaceId, @Param("userId") UUID userId);
}
