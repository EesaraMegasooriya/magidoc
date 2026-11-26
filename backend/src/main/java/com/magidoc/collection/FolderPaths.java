package com.magidoc.collection;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Folder paths written into names, e.g. "External User/Quiz" → ["External User", "Quiz"].
 * Must stay in sync with splitFolderPath() in frontend/src/lib/interchange.ts (same rules, same tests).
 */
final class FolderPaths {

    /** "GET /users", "POST/users": an uppercase HTTP method followed by a space or slash is a URL, not a folder. */
    private static final Pattern METHOD_PREFIX = Pattern.compile("^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)[\\s/]");
    private static final Pattern SCHEME = Pattern.compile("^[a-zA-Z][a-zA-Z0-9+.-]*://");
    private static final Pattern SPACE_BEFORE_SLASH = Pattern.compile("\\s/");

    private FolderPaths() {
    }

    /** Path segments, or null when the name isn't a folder path (no slash, URL-like, or empty segments). */
    static List<String> split(String name) {
        if (name == null) return null;
        String n = name.trim().replaceAll("/+$", "");
        if (!n.contains("/")) return null;
        if (n.startsWith("/") || SPACE_BEFORE_SLASH.matcher(n).find() || METHOD_PREFIX.matcher(n).find()
                || SCHEME.matcher(n).find() || n.contains("{{")) {
            return null;
        }
        List<String> parts = new ArrayList<>();
        for (String p : n.split("/", -1)) {
            String t = p.trim();
            if (t.isEmpty()) return null;
            parts.add(t);
        }
        return parts;
    }

    /** "External/" → "External" (folders only); unchanged when nothing remains. */
    static String withoutTrailingSlash(String name) {
        String s = name.trim().replaceAll("/+$", "").trim();
        return s.isEmpty() ? name : s;
    }
}
