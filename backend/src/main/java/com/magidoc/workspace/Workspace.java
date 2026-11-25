package com.magidoc.workspace;

import com.magidoc.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "workspaces")
@Getter
@Setter
public class Workspace extends BaseEntity {

    @Column(nullable = false)
    private String name;

    private String description;

    @Column(name = "owner_id", nullable = false)
    private UUID ownerId;

    /** Canonical join code (uppercase, no dash); null when joining by code is disabled. */
    @Column(name = "join_code", unique = true)
    private String joinCode;

    /** Role granted to people who join with the code. */
    @Enumerated(EnumType.STRING)
    @Column(name = "join_role", nullable = false)
    private WorkspaceRole joinRole = WorkspaceRole.EDITOR;
}
