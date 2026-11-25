package com.magidoc.auth;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface RecoveryCodeRepository extends JpaRepository<RecoveryCode, UUID> {

    List<RecoveryCode> findByUserIdAndUsedAtIsNull(UUID userId);

    List<RecoveryCode> findByUserIdOrderByCreatedAtDesc(UUID userId);

    @Modifying
    @Query("delete from RecoveryCode r where r.userId = :userId")
    void deleteAllForUser(@Param("userId") UUID userId);
}
