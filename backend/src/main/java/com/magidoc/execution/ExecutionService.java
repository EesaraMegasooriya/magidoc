package com.magidoc.execution;

import com.magidoc.collection.ApiRequestRepository;
import com.magidoc.collection.RequestService;
import com.magidoc.config.MagiDocProperties;
import com.magidoc.execution.ExecutionDtos.ExecuteRequest;
import com.magidoc.execution.ExecutionDtos.ExecuteResponse;
import com.magidoc.execution.ExecutionDtos.KeyValue;
import com.magidoc.history.RequestHistory;
import com.magidoc.history.RequestHistoryRepository;
import com.magidoc.security.SecurityUtils;
import com.magidoc.workspace.WorkspaceAccessService;
import com.magidoc.workspace.WorkspaceRole;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.net.ConnectException;
import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.net.http.HttpClient;
import java.net.http.HttpConnectTimeoutException;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.zip.GZIPInputStream;
import java.util.zip.InflaterInputStream;

/**
 * Executes user-defined HTTP requests server-side, so the browser is not limited by CORS.
 */
@Slf4j
@Service
public class ExecutionService {

    /** Headers the JDK client manages itself and refuses to accept. */
    private static final Set<String> RESTRICTED_HEADERS = Set.of("connection", "content-length", "expect", "host",
            "upgrade", "keep-alive", "transfer-encoding");

    private final MagiDocProperties.Proxy config;
    private final WorkspaceAccessService access;
    private final RequestHistoryRepository history;
    private final ApiRequestRepository requests;
    private final HttpClient followingClient;
    private final HttpClient nonFollowingClient;

    public ExecutionService(MagiDocProperties props, WorkspaceAccessService access,
                            RequestHistoryRepository history, ApiRequestRepository requests) {
        this.config = props.proxy();
        this.access = access;
        this.history = history;
        this.requests = requests;
        this.followingClient = buildClient(HttpClient.Redirect.NORMAL);
        this.nonFollowingClient = buildClient(HttpClient.Redirect.NEVER);
    }

    private HttpClient buildClient(HttpClient.Redirect redirect) {
        return HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(config.connectTimeout())
                .followRedirects(redirect)
                .build();
    }

    public ExecuteResponse execute(UUID workspaceId, ExecuteRequest req) {
        access.require(workspaceId, WorkspaceRole.VIEWER);
        UUID userId = SecurityUtils.currentUserId();
        ExecuteResponse response = send(req);
        record(workspaceId, userId, req, response);
        return response;
    }

    private ExecuteResponse send(ExecuteRequest req) {
        long start = System.nanoTime();
        try {
            String method = req.method().trim().toUpperCase(Locale.ROOT);
            if (!RequestService.METHODS.contains(method)) {
                return ExecuteResponse.failure("Unsupported HTTP method: " + method, 0);
            }
            URI uri = parseUri(req.url());
            if (config.blockPrivateNetworks()) assertPublicHost(uri);

            HttpRequest.Builder builder = HttpRequest.newBuilder(uri).timeout(timeout(req.timeoutMs()));
            boolean hasUserAgent = false;
            String multipartBoundary = null;
            HttpRequest.BodyPublisher publisher = HttpRequest.BodyPublishers.noBody();

            var body = req.body();
            if (body != null && "form-data".equalsIgnoreCase(body.mode())) {
                multipartBoundary = "----MagiDocBoundary" + UUID.randomUUID().toString().replace("-", "");
                publisher = HttpRequest.BodyPublishers.ofString(multipart(body.fields(), multipartBoundary));
            } else if (body != null && "raw".equalsIgnoreCase(body.mode()) && body.raw() != null) {
                publisher = HttpRequest.BodyPublishers.ofString(body.raw(), StandardCharsets.UTF_8);
            }

            if (req.headers() != null) {
                for (KeyValue h : req.headers()) {
                    if (h == null || h.key() == null || h.key().isBlank()) continue;
                    String name = h.key().trim();
                    String lower = name.toLowerCase(Locale.ROOT);
                    if (RESTRICTED_HEADERS.contains(lower)) continue;
                    if (multipartBoundary != null && lower.equals("content-type")) continue;
                    if (lower.equals("user-agent")) hasUserAgent = true;
                    builder.header(name, h.value() == null ? "" : h.value());
                }
            }
            if (multipartBoundary != null) {
                builder.header("Content-Type", "multipart/form-data; boundary=" + multipartBoundary);
            }
            if (!hasUserAgent) builder.header("User-Agent", "MagiDoc/0.1");
            builder.method(method, publisher);

            HttpClient client = Boolean.FALSE.equals(req.followRedirects()) ? nonFollowingClient : followingClient;
            HttpResponse<InputStream> resp = client.send(builder.build(), HttpResponse.BodyHandlers.ofInputStream());
            return readResponse(resp, start);
        } catch (IllegalArgumentException e) {
            return ExecuteResponse.failure("Invalid request: " + e.getMessage(), elapsed(start));
        } catch (HttpConnectTimeoutException e) {
            return ExecuteResponse.failure("Connection timed out", elapsed(start));
        } catch (HttpTimeoutException e) {
            return ExecuteResponse.failure("Request timed out", elapsed(start));
        } catch (ConnectException e) {
            return ExecuteResponse.failure("Could not connect to the server. Is it running and reachable?",
                    elapsed(start));
        } catch (UnknownHostException e) {
            return ExecuteResponse.failure("Unknown host: " + e.getMessage(), elapsed(start));
        } catch (IOException e) {
            return ExecuteResponse.failure("Network error: " + e.getMessage(), elapsed(start));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return ExecuteResponse.failure("Request was interrupted", elapsed(start));
        } catch (SecurityException e) {
            return ExecuteResponse.failure(e.getMessage(), elapsed(start));
        }
    }

    private ExecuteResponse readResponse(HttpResponse<InputStream> resp, long start) throws IOException {
        String contentType = resp.headers().firstValue("content-type").orElse(null);
        String encoding = resp.headers().firstValue("content-encoding").orElse("").toLowerCase(Locale.ROOT);

        byte[] bytes;
        boolean truncated;
        try (InputStream raw = resp.body(); InputStream in = decode(raw, encoding)) {
            long max = config.maxResponseBytes();
            bytes = in.readNBytes((int) Math.min(Integer.MAX_VALUE - 8, max + 1));
            truncated = bytes.length > max;
            if (truncated) bytes = java.util.Arrays.copyOf(bytes, (int) max);
        }
        long duration = elapsed(start);

        List<KeyValue> headers = new ArrayList<>();
        for (Map.Entry<String, List<String>> e : resp.headers().map().entrySet()) {
            if (e.getKey().startsWith(":")) continue;
            for (String v : e.getValue()) headers.add(new KeyValue(e.getKey(), v));
        }

        String body;
        String bodyEncoding;
        if (isTextual(contentType)) {
            body = new String(bytes, charsetOf(contentType));
            bodyEncoding = "text";
        } else {
            body = Base64.getEncoder().encodeToString(bytes);
            bodyEncoding = "base64";
        }
        HttpStatus status = HttpStatus.resolve(resp.statusCode());
        return new ExecuteResponse(resp.statusCode(), status == null ? "" : status.getReasonPhrase(), headers, body,
                bodyEncoding, contentType, duration, bytes.length, truncated, null);
    }

    private static InputStream decode(InputStream in, String contentEncoding) throws IOException {
        return switch (contentEncoding) {
            case "gzip", "x-gzip" -> new GZIPInputStream(in);
            case "deflate" -> new InflaterInputStream(in);
            default -> in;
        };
    }

    private static URI parseUri(String url) {
        String u = url.trim();
        if (!u.matches("(?i)^https?://.*")) {
            if (u.matches("(?i)^[a-z][a-z0-9+.-]*://.*")) {
                throw new IllegalArgumentException("only http and https URLs are supported");
            }
            u = "http://" + u;
        }
        if (u.contains("{{")) {
            throw new IllegalArgumentException("unresolved variable in URL - check your environment");
        }
        URI uri = URI.create(u.replace(" ", "%20"));
        if (uri.getHost() == null) throw new IllegalArgumentException("URL has no host");
        return uri;
    }

    private static void assertPublicHost(URI uri) throws UnknownHostException {
        for (InetAddress addr : InetAddress.getAllByName(uri.getHost())) {
            byte[] b = addr.getAddress();
            boolean uniqueLocalV6 = b.length == 16 && (b[0] & 0xfe) == 0xfc;
            if (addr.isAnyLocalAddress() || addr.isLoopbackAddress() || addr.isLinkLocalAddress()
                    || addr.isSiteLocalAddress() || addr.isMulticastAddress() || uniqueLocalV6) {
                throw new SecurityException("Requests to private network addresses are disabled on this server");
            }
        }
    }

    private Duration timeout(Integer timeoutMs) {
        Duration max = config.requestTimeout();
        if (timeoutMs == null || timeoutMs <= 0) return max;
        Duration requested = Duration.ofMillis(timeoutMs);
        return requested.compareTo(max) > 0 ? max : requested;
    }

    private static String multipart(List<KeyValue> fields, String boundary) {
        StringBuilder sb = new StringBuilder();
        if (fields != null) {
            for (KeyValue f : fields) {
                if (f == null || f.key() == null || f.key().isBlank()) continue;
                sb.append("--").append(boundary).append("\r\n")
                        .append("Content-Disposition: form-data; name=\"")
                        .append(f.key().replace("\"", "%22")).append("\"\r\n\r\n")
                        .append(f.value() == null ? "" : f.value()).append("\r\n");
            }
        }
        sb.append("--").append(boundary).append("--\r\n");
        return sb.toString();
    }

    private static boolean isTextual(String contentType) {
        if (contentType == null) return true;
        String ct = contentType.toLowerCase(Locale.ROOT);
        return ct.startsWith("text/") || ct.contains("json") || ct.contains("xml") || ct.contains("javascript")
                || ct.contains("x-www-form-urlencoded") || ct.contains("graphql") || ct.contains("yaml")
                || ct.contains("csv") || ct.contains("html");
    }

    private static Charset charsetOf(String contentType) {
        if (contentType != null) {
            for (String part : contentType.split(";")) {
                String p = part.trim();
                if (p.toLowerCase(Locale.ROOT).startsWith("charset=")) {
                    try {
                        return Charset.forName(p.substring(8).replace("\"", "").trim());
                    } catch (Exception ignored) {
                        // fall through to UTF-8
                    }
                }
            }
        }
        return StandardCharsets.UTF_8;
    }

    private static long elapsed(long startNanos) {
        return Duration.ofNanos(System.nanoTime() - startNanos).toMillis();
    }

    private void record(UUID workspaceId, UUID userId, ExecuteRequest req, ExecuteResponse res) {
        try {
            RequestHistory h = new RequestHistory();
            h.setWorkspaceId(workspaceId);
            h.setUserId(userId);
            h.setRequestId(req.requestId() != null && requests.existsById(req.requestId()) ? req.requestId() : null);
            h.setRequestName(req.requestName());
            h.setMethod(req.method().trim().toUpperCase(Locale.ROOT));
            h.setUrl(req.url().length() > 4000 ? req.url().substring(0, 4000) : req.url());
            h.setStatusCode(res.status() == 0 ? null : res.status());
            h.setDurationMs(res.durationMs());
            h.setResponseSize(res.size());
            history.save(h);
        } catch (RuntimeException e) {
            log.warn("Could not record request history", e);
        }
    }
}
