package com.magidoc.snippet;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface SnippetRepository extends JpaRepository<Snippet, UUID> {

    @Query("select s from Snippet s where s.workspaceId = :workspaceId order by s.pinned desc, s.updatedAt desc")
    List<Snippet> findAllInWorkspace(@Param("workspaceId") UUID workspaceId, Pageable pageable);

    /** {@code pattern} is a lower-case LIKE pattern whose literal %, _ and \\ are escaped with a backslash. */
    @Query("select s from Snippet s where s.workspaceId = :workspaceId and "
            + "(lower(s.title) like :pattern escape '\\' or lower(s.content) like :pattern escape '\\') "
            + "order by s.pinned desc, s.updatedAt desc")
    List<Snippet> search(@Param("workspaceId") UUID workspaceId, @Param("pattern") String pattern, Pageable pageable);
}
