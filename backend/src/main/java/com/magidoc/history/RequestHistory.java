package com.magidoc.history;

import com.magidoc.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "request_history")
@Getter
@Setter
public class RequestHistory extends BaseEntity {

    @Column(name = "workspace_id", nullable = false)
    private UUID workspaceId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "request_id")
    private UUID requestId;

    @Column(name = "request_name")
    private String requestName;

    @Column(nullable = false)
    private String method;

    @Column(nullable = false)
    private String url;

    @Column(name = "status_code")
    private Integer statusCode;

    @Column(name = "duration_ms")
    private Long durationMs;

    @Column(name = "response_size")
    private Long responseSize;
}
