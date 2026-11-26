package com.magidoc.collection;

import com.magidoc.common.ApiException;

import java.util.Locale;

/** How far a team has got with wiring an endpoint into their app. A request without a status is "not marked". */
public enum IntegrationStatus {
    NOT_STARTED("Not yet"),
    IN_PROGRESS("Integrating"),
    INTEGRATED("Integrated");

    private final String label;

    IntegrationStatus(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }

    /** Lenient parsing for imported files: accepts any case and "-"/" " separators; unknown values become null. */
    static IntegrationStatus parseOrNull(String value) {
        if (value == null || value.isBlank()) return null;
        String key = value.trim().toUpperCase(Locale.ROOT).replace('-', '_').replace(' ', '_');
        for (IntegrationStatus s : values()) {
            if (s.name().equals(key)) return s;
        }
        return null;
    }

    /** Strict parsing for the API: null/blank clears the status, anything unknown is a 400. */
    static IntegrationStatus parseStrict(String value) {
        if (value == null || value.isBlank()) return null;
        IntegrationStatus s = parseOrNull(value);
        if (s == null) {
            throw ApiException.badRequest("Unknown integration status: " + value
                    + " (use NOT_STARTED, IN_PROGRESS, INTEGRATED or null)");
        }
        return s;
    }
}
