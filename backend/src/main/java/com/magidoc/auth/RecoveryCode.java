package com.magidoc.auth;

import com.magidoc.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/** A one-time password-recovery code. Only its BCrypt hash is stored. */
@Entity
@Table(name = "recovery_codes")
@Getter
@Setter
public class RecoveryCode extends BaseEntity {

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "code_hash", nullable = false)
    private String codeHash;

    @Column(name = "used_at")
    private Instant usedAt;
}
