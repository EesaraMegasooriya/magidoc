package com.magidoc.common;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Flexible JSON columns (headers, params, body, auth, variables) are stored as JSON strings
 * and exposed to the API as JSON trees so the client owns their exact shape.
 */
@Component
@RequiredArgsConstructor
public class JsonSupport {

    private final ObjectMapper mapper;

    public JsonNode read(String json, JsonNode fallback) {
        if (json == null || json.isBlank()) {
            return fallback;
        }
        try {
            return mapper.readTree(json);
        } catch (JsonProcessingException e) {
            return fallback;
        }
    }

    public JsonNode readArray(String json) {
        return read(json, mapper.createArrayNode());
    }

    public JsonNode readObject(String json) {
        return read(json, mapper.createObjectNode());
    }

    public String write(JsonNode node) {
        if (node == null || node.isNull() || node.isMissingNode()) {
            return null;
        }
        try {
            return mapper.writeValueAsString(node);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Could not serialize JSON", e);
        }
    }

    public ArrayNode array() {
        return mapper.createArrayNode();
    }

    public ObjectNode object() {
        return mapper.createObjectNode();
    }

    public ObjectMapper mapper() {
        return mapper;
    }
}
