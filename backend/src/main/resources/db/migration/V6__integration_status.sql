-- Team workflow marker per request: has the frontend/app been wired up to this endpoint yet?
-- NULL means "not marked".
ALTER TABLE api_requests ADD COLUMN integration_status VARCHAR(20);
ALTER TABLE api_requests ADD CONSTRAINT ck_api_requests_integration_status
    CHECK (integration_status IN ('NOT_STARTED', 'IN_PROGRESS', 'INTEGRATED'));
