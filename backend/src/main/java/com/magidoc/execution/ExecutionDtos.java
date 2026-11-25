package com.magidoc.execution;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

public final class ExecutionDtos {

    private ExecutionDtos() {
    }

    public record KeyValue(String key, String value) {
    }

    /**
     * mode: "none" | "raw" | "form-data". For raw bodies (json, xml, text, urlencoded) the client sends
     * the final string plus the Content-Type header; form-data is encoded as multipart here.
     */
    public record ExecuteBody(String mode, String raw, List<KeyValue> fields) {
    }

    public record ExecuteRequest(@NotBlank String method, @NotBlank @Size(max = 8000) String url,
                                 List<KeyValue> headers, ExecuteBody body, UUID requestId,
                                 @Size(max = 200) String requestName, Boolean followRedirects, Integer timeoutMs) {
    }

    public record ExecuteResponse(int status, String statusText, List<KeyValue> headers, String body,
                                  String bodyEncoding, String contentType, long durationMs, long size,
                                  boolean truncated, String error) {

        static ExecuteResponse failure(String error, long durationMs) {
            return new ExecuteResponse(0, "Error", List.of(), "", "text", null, durationMs, 0, false, error);
        }
    }
}
