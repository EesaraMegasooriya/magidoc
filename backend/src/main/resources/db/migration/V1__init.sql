-- MagiDoc initial schema (portable: PostgreSQL + H2 in PostgreSQL mode)

CREATE TABLE users (
    id            UUID PRIMARY KEY,
    email         VARCHAR(255) NOT NULL UNIQUE,
    name          VARCHAR(120) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    avatar_color  VARCHAR(20),
    created_at    TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at    TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE workspaces (
    id          UUID PRIMARY KEY,
    name        VARCHAR(120) NOT NULL,
    description VARCHAR(1000),
    owner_id    UUID NOT NULL REFERENCES users (id),
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at  TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE workspace_members (
    id           UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    user_id      UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    role         VARCHAR(20) NOT NULL,
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at   TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_workspace_member UNIQUE (workspace_id, user_id)
);
CREATE INDEX idx_workspace_members_user ON workspace_members (user_id);

CREATE TABLE workspace_invitations (
    id           UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    email        VARCHAR(255) NOT NULL,
    role         VARCHAR(20) NOT NULL,
    invited_by   UUID REFERENCES users (id) ON DELETE SET NULL,
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at   TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_workspace_invitation UNIQUE (workspace_id, email)
);
CREATE INDEX idx_workspace_invitations_email ON workspace_invitations (email);

CREATE TABLE teams (
    id          UUID PRIMARY KEY,
    name        VARCHAR(120) NOT NULL,
    description VARCHAR(1000),
    owner_id    UUID NOT NULL REFERENCES users (id),
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at  TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE team_members (
    id         UUID PRIMARY KEY,
    team_id    UUID NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    role       VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_team_member UNIQUE (team_id, user_id)
);
CREATE INDEX idx_team_members_user ON team_members (user_id);

CREATE TABLE workspace_teams (
    id           UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    team_id      UUID NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
    role         VARCHAR(20) NOT NULL,
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at   TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_workspace_team UNIQUE (workspace_id, team_id)
);
CREATE INDEX idx_workspace_teams_team ON workspace_teams (team_id);

CREATE TABLE collections (
    id           UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    name         VARCHAR(150) NOT NULL,
    description  VARCHAR,
    variables    VARCHAR,
    auth         VARCHAR,
    created_by   UUID REFERENCES users (id) ON DELETE SET NULL,
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at   TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX idx_collections_workspace ON collections (workspace_id);

CREATE TABLE folders (
    id            UUID PRIMARY KEY,
    collection_id UUID NOT NULL REFERENCES collections (id) ON DELETE CASCADE,
    parent_id     UUID REFERENCES folders (id) ON DELETE CASCADE,
    name          VARCHAR(150) NOT NULL,
    description   VARCHAR,
    sort_order    INT NOT NULL DEFAULT 0,
    created_at    TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at    TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX idx_folders_collection ON folders (collection_id);

CREATE TABLE api_requests (
    id            UUID PRIMARY KEY,
    collection_id UUID NOT NULL REFERENCES collections (id) ON DELETE CASCADE,
    folder_id     UUID REFERENCES folders (id) ON DELETE CASCADE,
    name          VARCHAR(200) NOT NULL,
    method        VARCHAR(10) NOT NULL,
    url           VARCHAR(4000) NOT NULL,
    description   VARCHAR,
    headers       VARCHAR,
    query_params  VARCHAR,
    body          VARCHAR,
    auth          VARCHAR,
    examples      VARCHAR,
    sort_order    INT NOT NULL DEFAULT 0,
    created_at    TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at    TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX idx_api_requests_collection ON api_requests (collection_id);
CREATE INDEX idx_api_requests_folder ON api_requests (folder_id);

CREATE TABLE environments (
    id           UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    name         VARCHAR(120) NOT NULL,
    variables    VARCHAR,
    is_global    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at   TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX idx_environments_workspace ON environments (workspace_id);

CREATE TABLE request_history (
    id            UUID PRIMARY KEY,
    workspace_id  UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    user_id       UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    request_id    UUID REFERENCES api_requests (id) ON DELETE SET NULL,
    request_name  VARCHAR(200),
    method        VARCHAR(10) NOT NULL,
    url           VARCHAR(4000) NOT NULL,
    status_code   INT,
    duration_ms   BIGINT,
    response_size BIGINT,
    created_at    TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at    TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX idx_history_workspace_user ON request_history (workspace_id, user_id, created_at);

CREATE TABLE share_links (
    id            UUID PRIMARY KEY,
    token         VARCHAR(64) NOT NULL UNIQUE,
    collection_id UUID NOT NULL REFERENCES collections (id) ON DELETE CASCADE,
    created_by    UUID REFERENCES users (id) ON DELETE SET NULL,
    enabled       BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at    TIMESTAMP WITH TIME ZONE,
    view_count    BIGINT NOT NULL DEFAULT 0,
    created_at    TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at    TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX idx_share_links_collection ON share_links (collection_id);

CREATE TABLE activities (
    id           UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
    user_id      UUID REFERENCES users (id) ON DELETE SET NULL,
    action       VARCHAR(50) NOT NULL,
    target_type  VARCHAR(50) NOT NULL,
    target_name  VARCHAR(255),
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at   TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX idx_activities_workspace ON activities (workspace_id, created_at);
