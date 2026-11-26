<p align="center">
  <img src="logo.svg" width="88" alt="MagiDoc logo" />
</p>

<h1 align="center">MagiDoc</h1>
<p align="center"><b>Design, test, document and share your APIs, together.</b></p>

---

MagiDoc is a collaborative API platform in the spirit of Postman: organize requests into collections, run them against environments, write Markdown docs, and publish beautiful public documentation with one link.

## Features

| Area | What you get |
|---|---|
| **Request runner** | All HTTP methods, params ↔ URL sync, headers, JSON/XML/Text/HTML/urlencoded/form-data bodies, Bearer/Basic/API-key auth (with collection-level inheritance). Requests run **server-side**, so there are no CORS problems. Gzip/deflate, binary and image responses, HTML preview. |
| **Variables** | `{{var}}` everywhere. Precedence: **Globals → Collection → Active environment**. Secret variables are masked. Undefined variables are flagged inline. |
| **Collections** | Nested folders, drag & drop, duplicate, rename, move, filter, and a **collection runner** with pass/fail summary. |
| **Docs** | Markdown docs per collection/folder/request, saved response **examples**, and auto-generated code samples (cURL, JavaScript fetch, Axios, Python, raw HTTP). |
| **Sharing** | Public read-only doc links with optional expiry, enable/disable, revoke, and view counts. Auth values, sensitive headers and secret variables are stripped automatically. |
| **Collaboration** | Workspaces with roles (**Owner / Admin / Editor / Viewer**), simple **join codes**, **Teams** that can be shared into workspaces, and an activity feed. |
| **Import / export** | Postman v2.1, OpenAPI 3 & Swagger 2 (JSON/YAML), cURL commands, and the native MagiDoc format. Import **several files at once** and they are **auto-merged** into one collection, or **merge into an existing collection** (matching requests are updated in place, new ones added). Export to MagiDoc or Postman. |
| **Text space** | Share notes (Markdown) and code snippets with everyone in a workspace instead of sending them around. Search titles and content, filter by All / Mine / Pinned, pin important texts, copy in one click. Edits are version-checked, so a teammate's save is never silently overwritten: you choose *Load latest* or *Overwrite with mine*. Editors create and edit; only the author or an admin can delete. |
| **WebSocket testing** | Saved connections per workspace: connect/disconnect, `{{variables}}`, subprotocols, a Text/JSON composer, saved message templates, and a live log with sent/received filters, search and JSON pretty-printing. |
| **Productivity** | Tabs with unsaved-change tracking, request history, `⌘/Ctrl+Enter` to send, `⌘/Ctrl+S` to save, resizable panes. |

## Tech stack

- **Frontend:** React 19, Vite, TypeScript, Tailwind CSS v4, TanStack Query, Zustand, React Router
- **Backend:** Spring Boot 3.5 (Java 17), Spring Security (JWT resource server), Spring Data JPA, Flyway, Springdoc OpenAPI
- **Database:** H2 file DB in dev (zero setup), PostgreSQL in production

```
MagiDoc/
├── backend/            Spring Boot API  (package-by-feature: auth, workspace, team, collection, environment, execution, history, share, activity)
│   └── src/main/resources/db/migration   Flyway SQL migrations
├── frontend/           React + Vite SPA
│   └── src/{api,lib,store,components,pages,features}
└── docker-compose.yml  Postgres + backend + nginx-served frontend
```

## Getting started (development)

**Prerequisites:** Java 17+, Maven 3.9+, Node 20+.

```bash
# 1. Backend → http://localhost:8080   (H2 data is stored in backend/data/)
cd backend
mvn spring-boot:run

# 2. Frontend → http://localhost:5173   (proxies /api to :8080)
cd frontend
npm install
npm run dev
```

Sign up, and you get a personal workspace with a **Getting Started** collection to explore.

- API reference (Swagger UI): http://localhost:8080/swagger-ui.html
- Run backend tests: `cd backend && mvn test`
- Type-check and build the frontend: `cd frontend && npm run build`

## Production (Docker)

**Step-by-step server guide: [deploy/README.md](deploy/README.md)** (Docker Compose behind your existing nginx with Let's Encrypt HTTPS, backups and updates).

```bash
cp .env.example .env              # set MAGIDOC_PUBLIC_URL, MAGIDOC_JWT_SECRET, DB_PASSWORD
docker compose up -d --build      # app on 127.0.0.1:3000 → put nginx/HTTPS in front
```

### Configuration

| Variable | Default | Purpose |
|---|---|---|
| `SPRING_PROFILES_ACTIVE` | `dev` | `dev` = H2, `prod` = PostgreSQL |
| `MAGIDOC_JWT_SECRET` | dev-only value | **Must** be set in production (≥ 32 chars) |
| `MAGIDOC_JWT_EXPIRATION` | `7d` | Token lifetime |
| `MAGIDOC_COOKIE_SECURE` | `false` (dev), `true` (prod profile) | `Secure` flag on the session cookie; must be `true` behind HTTPS |
| `MAGIDOC_CORS_ORIGINS` | `http://localhost:*,http://127.0.0.1:*` | Allowed origins (patterns allowed). Use exact origins in production. |
| `MAGIDOC_PROXY_BLOCK_PRIVATE` | `false` | Blocks the request runner from calling private/loopback IPs (SSRF protection). Enable it on shared servers. |
| `DB_URL` / `DB_USERNAME` / `DB_PASSWORD` | — | PostgreSQL connection (prod profile) |

## Joining a workspace

There are no emails to configure. Admins open **Settings → Members & teams** and create a **join code** (e.g. `K7QM-X2PD`), choosing whether it grants **Viewer** or **Editor** access. Anyone signed in to MagiDoc clicks **Join workspace** on the dashboard and enters the code.

- Admins can copy the code, change the role it grants, **generate a new code** (the old one stops working immediately) or **turn joining off**.
- Codes use 8 unambiguous characters and are not case-sensitive. After 10 wrong guesses in 15 minutes, a user is temporarily blocked from trying again.
- People who already have an account can also be added directly by email (nothing is sent).

## Security

- **Sessions** live in an `HttpOnly`, `SameSite=Lax` cookie (`Secure` in production), so page scripts can't read them. API clients can still send `Authorization: Bearer <token>`; the token is returned by sign-in for that purpose.
- **CSRF:** every state-changing `/api` request without an `Authorization` header must include `X-MagiDoc-Client`. Browsers can't add custom headers to cross-site requests without a CORS preflight, which only allowed origins pass.
- **Revocation:** changing or resetting a password, or *Security → Sign out of all devices*, invalidates every existing token.
- **Password recovery without email:** users create 10 one-time **recovery codes** (*account menu → Security & recovery*, current password required). They're stored only as BCrypt hashes. *Forgot password?* resets the password with one code and signs out everywhere. The dashboard reminds users who haven't created codes.
- **Brute-force protection:** sign-in is throttled per account (5 failures / 15 min) and per IP (30 / 15 min); recovery codes and join codes are throttled too. Failed sign-ins take the same time whether or not the account exists.
- The limiter is in memory per instance; use a shared store such as Redis if you run several backend instances.

## Testing

```bash
cd backend && mvn test                 # API integration tests (H2 in memory)
cd frontend && npm run build           # type-check + production build
cd frontend && npx playwright test     # end-to-end: starts backend + Vite itself
E2E_BASE_URL=http://localhost:5173 npx playwright test   # …or reuse servers you already run
E2E_EXTERNAL=1 npx playwright test     # also run tests that need the internet (WebSocket echo)
```

Locally Playwright uses your installed Chrome. CI (`.github/workflows/ci.yml`) runs all three on every push and pull request, and uploads traces when an end-to-end test fails.

## Permissions model

| Role | Read & send | Edit collections/envs | Manage members, teams & roles | Delete workspace |
|---|:-:|:-:|:-:|:-:|
| Viewer | ✅ | | | |
| Editor | ✅ | ✅ | | |
| Admin | ✅ | ✅ | ✅ (except other admins) | |
| Owner | ✅ | ✅ | ✅ | ✅ |

A person's effective role is the **highest** of their direct membership and any team shared with the workspace. Users without access get `404`, so workspace IDs can't be probed.

## Roadmap ideas

Pre-request and test scripts, mock servers, GraphQL, Socket.IO / SSE, OAuth 2.0 helpers, real-time co-editing, comments on requests, request versioning, join codes for teams, and SSO.
