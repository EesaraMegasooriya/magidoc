package com.magidoc.user;

import java.time.Instant;
import java.util.UUID;

public record UserDto(UUID id, String email, String name, String avatarColor, Instant createdAt) {

    public static UserDto from(User u) {
        return new UserDto(u.getId(), u.getEmail(), u.getName(), u.getAvatarColor(), u.getCreatedAt());
    }
}
