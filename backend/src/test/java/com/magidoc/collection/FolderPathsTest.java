package com.magidoc.collection;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

import java.util.List;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/** Same cases as splitFolderPath in frontend/src/lib/interchange.test.ts — the two must agree. */
class FolderPathsTest {

    static Stream<Arguments> cases() {
        return Stream.of(
                Arguments.of("External/Get users", List.of("External", "Get users")),
                Arguments.of("External/ Get users", List.of("External", "Get users")),
                Arguments.of("External/Payments/Refund", List.of("External", "Payments", "Refund")),
                Arguments.of("External User/Quiz", List.of("External User", "Quiz")),
                Arguments.of("External User/Session/All Sessions", List.of("External User", "Session", "All Sessions")),
                Arguments.of("  External / Payments ", null),
                Arguments.of("External/", null),
                Arguments.of("GET /users/{id}", null),
                Arguments.of("POST/users", null),
                Arguments.of("/health", null),
                Arguments.of("https://api.example.com/users", null),
                Arguments.of("{{baseUrl}}/users", null),
                Arguments.of("a//b", null),
                Arguments.of("Plain name", null));
    }

    @ParameterizedTest(name = "{0} → {1}")
    @MethodSource("cases")
    void split(String name, List<String> expected) {
        assertThat(FolderPaths.split(name)).isEqualTo(expected);
    }
}
