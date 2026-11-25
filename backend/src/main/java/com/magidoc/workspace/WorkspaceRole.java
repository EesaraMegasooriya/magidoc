package com.magidoc.workspace;

/** Ordered from least to most privileged. */
public enum WorkspaceRole {
    VIEWER, EDITOR, ADMIN, OWNER;

    public boolean atLeast(WorkspaceRole other) {
        return ordinal() >= other.ordinal();
    }

    public static WorkspaceRole max(WorkspaceRole a, WorkspaceRole b) {
        if (a == null) return b;
        if (b == null) return a;
        return a.atLeast(b) ? a : b;
    }
}
