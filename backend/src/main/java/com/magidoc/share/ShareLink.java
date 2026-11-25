package com.magidoc.share;

import com.magidoc.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "share_links")
@Getter
@Setter
public class ShareLink extends BaseEntity {

    @Column(nullable = false, unique = true)
    private String token;

    @Column(name = "collection_id", nullable = false)
    private UUID collectionId;

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(nullable = false)
    private boolean enabled = true;

    @Column(name = "expires_at")
    private Instant expiresAt;

    @Column(name = "view_count", nullable = false)
    private long viewCount;

    public boolean isActive() {
        return enabled && (expiresAt == null || expiresAt.isAfter(Instant.now()));
    }
}
