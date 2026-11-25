package com.magidoc.environment;

import com.magidoc.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "environments")
@Getter
@Setter
public class Environment extends BaseEntity {

    @Column(name = "workspace_id", nullable = false)
    private UUID workspaceId;

    @Column(nullable = false)
    private String name;

    /** JSON array of {key, value, enabled, secret}. */
    private String variables;

    /** The single "Globals" environment of a workspace; always active. */
    @Column(name = "is_global", nullable = false)
    private boolean global;
}
