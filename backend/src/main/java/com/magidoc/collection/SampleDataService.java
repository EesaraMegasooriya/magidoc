package com.magidoc.collection;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/** Seeds a friendly "Getting Started" collection for new users. */
@Service
@RequiredArgsConstructor
public class SampleDataService {

    private final ApiCollectionRepository collections;
    private final FolderRepository folders;
    private final ApiRequestRepository requests;

    @Transactional
    public void seed(UUID workspaceId, UUID userId) {
        ApiCollection c = new ApiCollection();
        c.setWorkspaceId(workspaceId);
        c.setCreatedBy(userId);
        c.setName("Getting Started");
        c.setDescription("""
                # Welcome to MagiDoc ✨

                This sample collection talks to the free [JSONPlaceholder](https://jsonplaceholder.typicode.com) API.

                - Use `{{baseUrl}}` style **variables** — this one is defined on the collection.
                - Write **Markdown docs** for every collection, folder and request.
                - **Share** the docs publicly with a link, or invite your team to collaborate.
                """);
        c.setVariables("[{\"key\":\"baseUrl\",\"value\":\"https://jsonplaceholder.typicode.com\",\"enabled\":true,\"secret\":false}]");
        c.setAuth("{\"type\":\"none\"}");
        c = collections.save(c);

        Folder posts = new Folder();
        posts.setCollectionId(c.getId());
        posts.setName("Posts");
        posts.setDescription("Endpoints for reading and writing blog posts.");
        posts.setSortOrder(0);
        posts = folders.save(posts);

        request(c.getId(), posts.getId(), 0, "List posts", "GET", "{{baseUrl}}/posts",
                "Returns all posts. Use the `userId` query parameter to filter.",
                "[{\"id\":\"q1\",\"key\":\"userId\",\"value\":\"1\",\"enabled\":false,\"description\":\"Filter by author\"}]",
                null);
        request(c.getId(), posts.getId(), 1, "Get a post", "GET", "{{baseUrl}}/posts/1",
                "Fetch a single post by its id.", "[]", null);
        request(c.getId(), posts.getId(), 2, "Create a post", "POST", "{{baseUrl}}/posts",
                "Creates a new post. JSONPlaceholder fakes the write and echoes your payload.", "[]",
                "{\"mode\":\"json\",\"raw\":\"{\\n  \\\"title\\\": \\\"Hello MagiDoc\\\",\\n  \\\"body\\\": \\\"My first request\\\",\\n  \\\"userId\\\": 1\\n}\",\"fields\":[]}");
        request(c.getId(), null, 3, "List users", "GET", "{{baseUrl}}/users",
                "Returns the list of users.", "[]", null);
    }

    private void request(UUID collectionId, UUID folderId, int order, String name, String method, String url,
                         String description, String query, String body) {
        ApiRequest r = new ApiRequest();
        r.setCollectionId(collectionId);
        r.setFolderId(folderId);
        r.setSortOrder(order);
        r.setName(name);
        r.setMethod(method);
        r.setUrl(url);
        r.setDescription(description);
        r.setQueryParams(query);
        r.setHeaders(body == null ? "[]"
                : "[{\"id\":\"h1\",\"key\":\"Content-Type\",\"value\":\"application/json\",\"enabled\":true}]");
        r.setBody(body);
        r.setAuth("{\"type\":\"inherit\"}");
        r.setExamples("[]");
        requests.save(r);
    }
}
