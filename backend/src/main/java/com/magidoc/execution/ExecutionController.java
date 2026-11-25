package com.magidoc.execution;

import com.magidoc.execution.ExecutionDtos.ExecuteRequest;
import com.magidoc.execution.ExecutionDtos.ExecuteResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class ExecutionController {

    private final ExecutionService executionService;

    @PostMapping("/api/workspaces/{workspaceId}/execute")
    public ExecuteResponse execute(@PathVariable UUID workspaceId, @Valid @RequestBody ExecuteRequest req) {
        return executionService.execute(workspaceId, req);
    }
}
