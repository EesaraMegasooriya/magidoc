package com.magidoc.user;

import com.magidoc.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "users")
@Getter
@Setter
public class User extends BaseEntity {

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String name;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(name = "avatar_color")
    private String avatarColor;

    /** Embedded in every token; incrementing it revokes all of the user's sessions. */
    @Column(name = "token_version", nullable = false)
    private int tokenVersion;
}
