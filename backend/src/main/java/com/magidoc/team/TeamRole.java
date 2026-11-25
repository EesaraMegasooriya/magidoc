package com.magidoc.team;

public enum TeamRole {
    MEMBER, ADMIN, OWNER;

    public boolean atLeast(TeamRole other) {
        return ordinal() >= other.ordinal();
    }
}
