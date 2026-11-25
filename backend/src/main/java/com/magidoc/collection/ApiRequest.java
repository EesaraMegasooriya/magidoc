package com.magidoc.collection;

import com.magidoc.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.util.UUID;

@Entity
@Table(name = "api_requests")
@Getter
@Setter
public class ApiRequest extends BaseEntity {

    @Column(name = "collection_id", nullable = false)
    private UUID collectionId;

    @Column(name = "folder_id")
    private UUID folderId;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String method;

    @Column(nullable = false)
    private String url;

    private String description;

    /** JSON array of {key, value, enabled, description}. */
    private String headers;

    @Column(name = "query_params")
    private String queryParams;

    /** JSON {mode, raw, fields}. */
    private String body;

    private String auth;

    /** JSON array of saved example responses. */
    private String examples;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;
}
