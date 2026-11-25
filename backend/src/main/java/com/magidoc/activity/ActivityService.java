package com.magidoc.activity;

import com.magidoc.user.User;
import com.magidoc.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ActivityService {

    private final ActivityRepository activities;
    private final UserRepository users;

    public record ActivityDto(UUID id, UUID userId, String userName, String userColor, String action,
                              String targetType, String targetName, Instant createdAt) {
    }

    @Transactional
    public void log(UUID workspaceId, UUID userId, String action, String targetType, String targetName) {
        Activity a = new Activity();
        a.setWorkspaceId(workspaceId);
        a.setUserId(userId);
        a.setAction(action);
        a.setTargetType(targetType);
        a.setTargetName(targetName != null && targetName.length() > 255 ? targetName.substring(0, 255) : targetName);
        activities.save(a);
    }

    @Transactional(readOnly = true)
    public List<ActivityDto> recent(UUID workspaceId, int limit) {
        List<Activity> list = activities.findByWorkspaceIdOrderByCreatedAtDesc(workspaceId,
                PageRequest.of(0, Math.max(1, Math.min(limit, 200))));
        Map<UUID, User> byId = users.mapByIds(list.stream().map(Activity::getUserId)
                .filter(java.util.Objects::nonNull).distinct().toList());
        return list.stream().map(a -> {
            User u = a.getUserId() == null ? null : byId.get(a.getUserId());
            return new ActivityDto(a.getId(), a.getUserId(), u == null ? "Someone" : u.getName(),
                    u == null ? null : u.getAvatarColor(), a.getAction(), a.getTargetType(), a.getTargetName(),
                    a.getCreatedAt());
        }).toList();
    }
}
