package com.magidoc.snippet;

import com.magidoc.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.Getter;
import org.hibernate.annotations.OptimisticLock;
import lombok.Setter;

import java.util.UUID;

/** A note (Markdown) or code snippet shared with everyone in a workspace. */
@Entity
@Table(name = "snippets")
@Getter
@Setter
public class Snippet extends BaseEntity {

    public enum Kind { NOTE, CODE }

    @Column(name = "workspace_id", nullable = false)
    private UUID workspaceId;

    @Column(nullable = false)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Kind kind;

    /** Code language (e.g. "json", "python"); null for notes. */
    private String language;

    @Column(nullable = false)
    private String content = "";

    /** Pinning is a lightweight toggle and must not invalidate teammates' in-progress edits. */
    @OptimisticLock(excluded = true)
    @Column(nullable = false)
    private boolean pinned;

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(name = "updated_by")
    private UUID updatedBy;

    /** Optimistic lock: prevents one teammate silently overwriting another's edits. */
    @Version
    @Column(nullable = false)
    private long version;
}
