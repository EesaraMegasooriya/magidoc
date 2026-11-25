package com.magidoc.collection;

import com.magidoc.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "collections")
@Getter
@Setter
public class ApiCollection extends BaseEntity {

    @Column(name = "workspace_id", nullable = false)
    private UUID workspaceId;

    @Column(nullable = false)
    private String name;

    private String description;

    /** JSON array of {key, value, enabled, secret}. */
    private String variables;

    /** JSON auth config applied to requests that inherit auth. */
    private String auth;

    @Column(name = "created_by")
    private UUID createdBy;
}
