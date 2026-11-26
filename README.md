<p align="center">
  <img src="logo.svg" width="96" alt="MagiDoc logo" />
</p>

<h1 align="center">MagiDoc</h1>

<p align="center">
  <b>Design, test, document and share your APIs, together.</b><br />
  A self-hostable, collaborative API platform in the spirit of Postman.
</p>

<p align="center">
  <a href="https://github.com/EesaraMegasooriya/magidoc/actions/workflows/ci.yml"><img src="https://github.com/EesaraMegasooriya/magidoc/actions/workflows/ci.yml/badge.svg" alt="CI status" /></a>
  <a href="https://magidoc.eesara.com"><img src="https://img.shields.io/badge/live-magidoc.eesara.com-6d4aff?style=flat&logo=icloud&logoColor=white" alt="Live app" /></a>
  <img src="https://img.shields.io/badge/self--hosted-Docker%20Compose-2496ED?style=flat&logo=docker&logoColor=white" alt="Docker Compose" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-6-646CFF?style=flat&logo=vite&logoColor=white" alt="Vite 6" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat&logo=tailwindcss&logoColor=white" alt="Tailwind CSS 4" />
  <img src="https://img.shields.io/badge/Spring_Boot-3.5-6DB33F?style=flat&logo=springboot&logoColor=white" alt="Spring Boot 3.5" />
  <img src="https://img.shields.io/badge/Java-17-ED8B00?style=flat&logo=openjdk&logoColor=white" alt="Java 17" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat&logo=postgresql&logoColor=white" alt="PostgreSQL 16" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/tests-JUnit%20%7C%20Vitest%20%7C%20Playwright-2EAD33?style=flat&logo=playwright&logoColor=white" alt="Tests: JUnit, Vitest, Playwright" />
  <img src="https://img.shields.io/badge/theme-light%20%26%20dark-16161d?style=flat" alt="Light and dark theme" />
  <img src="https://img.shields.io/badge/made%20by-Eesara%20Megasooriya-a855f7?style=flat" alt="Made by Eesara Megasooriya" />
</p>

<p align="center">
  <a href="#-features">Features</a> ·
  <a href="#-quick-start">Quick start</a> ·
  <a href="#-user-guide">User guide</a> ·
  <a href="#-self-hosting">Self-hosting</a> ·
  <a href="#-security">Security</a> ·
  <a href="#-development">Development</a> ·
  <a href="#-developer">Developer</a>
</p>

---

## ✨ What is MagiDoc?

You can use MagiDoc to:

- organize API requests into collections and folders, and send them against environments full of `{{variables}}`;
- write Markdown documentation next to each request;
- publish read-only documentation with a single link.

Your team works in shared workspaces. Members join with a simple code, notes and code snippets live in a shared Text space, and WebSocket APIs can be tested in the same place.

It runs on your own server with one `docker compose up`. No emails, external services or paid plans are needed.

---

## 🚀 Features

### Request runner
- All HTTP methods, with query params kept in sync with the URL.
- Headers, plus JSON, XML, Text, HTML, `x-www-form-urlencoded` and `form-data` bodies.
- Bearer, Basic and API-key auth. Auth can be **inherited from the collection**.
- Requests run **server-side** by default, so CORS problems don't apply.
- Responses: gzip/deflate decoding, binary and image responses, HTML preview, pretty JSON with syntax colours, plus timing and size.
- **Local Agent** for APIs on your own machine or network (`localhost`, `192.168.x.x`). See [Calling localhost APIs](#-calling-localhost-apis-local-agent).

### Variables
- Use `{{variable}}` anywhere: URL, params, headers, auth and body.
- Precedence: **Globals → Collection → Active environment**. The most specific value wins.
- **Colour-coded while you type:**
  - 🟢 green: defined
  - 🟡 amber: defined but empty
  - 🔴 red: not defined anywhere
- Hover a variable to see its value and where it comes from.
- **Status dots** in the variable editor flag empty values and invalid names.
- **Secret** variables are masked on screen and never included in shared docs.

### Collections and folders
- Nested folders, drag and drop, duplicate, rename, move and filter.
- A **collection runner** that runs every request and shows a pass/fail summary.
- **Folder-path names:** a request or folder named `External User/Quiz` is placed in a **Quiz** folder inside **External User**.
- **Organize into folders:** fix collections that were imported flat with one click. Same-named folders are merged, and nothing is deleted.

### Import and export
- **Postman v2.1**, **OpenAPI 3** and **Swagger 2** (JSON or YAML), **cURL** commands, and the native MagiDoc format.
- **Import several files at once.** They are **auto-merged** into one collection.
- **Merge into an existing collection.** Matching requests are updated in place and new ones are added.
- Export to MagiDoc or Postman format.

### Documentation and sharing
- Markdown docs for each collection, folder and request, with saved response **examples**.
- Auto-generated code samples: cURL, JavaScript `fetch`, Axios, Python and raw HTTP.
- **Public read-only doc links** with optional expiry, enable/disable, revoke and view counts.
- Auth values, sensitive headers and secret variables are **stripped automatically** from shared docs.

### Collaboration
- **Workspaces** with roles: **Owner, Admin, Editor and Viewer**.
- **Join codes** such as `K7QM-X2PD`. There are no invitation emails to configure.
- **Teams** that can be shared into workspaces, and an **activity feed**.

### Text space
- Share Markdown notes and code snippets with your workspace instead of pasting them into chats.
- Search, filter by *All*, *Mine* or *Pinned*, pin important items and copy in one click.
- **Conflict-safe editing:** a teammate's save is never silently overwritten. You choose *Load latest* or *Overwrite with mine*.

### WebSocket testing
- Saved connections with `{{variables}}` and subprotocols.
- A Text/JSON composer and saved message templates.
- A live log with sent/received filters, search and JSON pretty-printing.

### Productivity and polish
- Tabs with unsaved-change tracking, request history and resizable panes.
- `⌘/Ctrl + Enter` sends a request and `⌘/Ctrl + S` saves it.
- **Light and dark themes**, and keyboard access throughout.
- An **update banner** tells open tabs when a new version has been deployed.

---

## ⚡ Quick start

### Run it with Docker

```bash
git clone https://github.com/EesaraMegasooriya/magidoc.git
cd magidoc
cp .env.example .env          # fill in MAGIDOC_PUBLIC_URL, MAGIDOC_JWT_SECRET, DB_PASSWORD
docker compose up -d --build  # app on http://127.0.0.1:3000
```

Put HTTPS in front of it (nginx, Caddy or a Cloudflare Tunnel). See [Self-hosting](#-self-hosting).

### Run it for development

**Prerequisites:** Java 17+, Maven 3.9+ and Node 20+.

```bash
# Terminal 1: backend on http://localhost:8080 (H2 database in backend/data/, no setup)
cd backend
mvn spring-boot:run

# Terminal 2: frontend on http://localhost:5173 (proxies /api to :8080)
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 and sign up. You get a personal workspace with a **Getting Started** collection to explore.

The API reference (Swagger UI) is at http://localhost:8080/swagger-ui.html.

---

## 📖 User guide

### For everyone
1. **Sign up** and open your personal workspace, or **Join workspace** with a code from your admin.
2. **Create a recovery code set** in *account menu → Security & recovery*. MagiDoc sends no emails, so these codes are the only way to reset a forgotten password. Store them somewhere safe.
3. **Pick an environment** in the top bar. Your `{{variables}}` turn green when they resolve.
4. Open a request, press **Send** (`⌘/Ctrl + Enter`), then **Save** (`⌘/Ctrl + S`).

### Joining a workspace
- Admins open **Settings → Members & teams** and create a **join code**. They choose whether it grants **Viewer** or **Editor** access.
- Anyone signed in clicks **Join workspace** on the dashboard and enters the code. Codes are not case-sensitive.
- Admins can copy the code, change the role it grants, **generate a new code** (the old one stops working immediately) or **turn joining off**.
- People who already have an account can also be added directly by email. No email is actually sent.

### Importing collections
1. Click **Import** and drop in one or more Postman, OpenAPI, Swagger, cURL or MagiDoc files.
2. Choose **New collection** or **Merge into an existing one**.
3. Leave **"Create folders from names like …"** ticked. Then a name like `Internal User/Conferences/Create` lands in the right folder automatically.

Imported something flat before this existed? Open the collection and click **Organize into folders**. It is in the sidebar prompt, the banner on the collection page, and the **⋯** menu.

### Variable colours

| Colour | Meaning | What to do |
|---|---|---|
| 🟢 Green | Defined and has a value | Nothing |
| 🟡 Amber | Defined but empty | Fill in the value in Globals, the collection or the environment |
| 🔴 Red | Not defined anywhere | Create the variable, check the spelling, or select the right environment |

### 🔌 Calling localhost APIs (Local Agent)

On a hosted MagiDoc, requests are sent **from the server**. The server cannot reach `localhost` or private IPs on your computer. The **Local Agent** is a tiny, dependency-free Node.js script that sends those requests from your own machine instead.

1. Install **Node.js 18+** (check with `node -v`).
2. In MagiDoc, click the **agent indicator** in the top bar and download `magidoc-agent.mjs`.
3. Run it, replacing the address with your MagiDoc's:
   ```bash
   node magidoc-agent.mjs --origin https://magidoc.example.com
   ```
4. If Chrome asks to allow access to devices on your local network, click **Allow**.

In **Automatic** mode (the default), requests to `localhost`, `127.0.0.1` and private IPs go through the agent, and everything else goes through the server.

The agent listens only on `127.0.0.1:47321` and only accepts pages from the `--origin` you pass, so other websites can't use it. Stop it with `Ctrl + C`.

### Permissions

| Role | Read and send | Edit collections and envs | Manage members, teams and roles | Delete workspace |
|---|:-:|:-:|:-:|:-:|
| Viewer | ✅ | | | |
| Editor | ✅ | ✅ | | |
| Admin | ✅ | ✅ | ✅ (except other admins) | |
| Owner | ✅ | ✅ | ✅ | ✅ |

Your effective role is the **highest** of your direct membership and any team shared with the workspace. Users without access get `404`, so workspace IDs can't be probed.

---

## 🖥️ Self-hosting

**Full step-by-step guide: [deploy/README.md](deploy/README.md).** It covers Docker Compose behind nginx with Let's Encrypt, a Cloudflare Tunnel, backups and updates.

### Architecture

```
Browser ──HTTPS──▶ nginx / Cloudflare Tunnel ──▶ frontend (nginx :80, on 127.0.0.1:3000)
                                                    ├── serves the React app
                                                    └── /api ──▶ backend (Spring Boot :8080) ──▶ PostgreSQL 16
```

### Configuration (`.env`)

| Variable | Default | Purpose |
|---|---|---|
| `MAGIDOC_PUBLIC_URL` | (none) | The public `https://` address people open |
| `MAGIDOC_JWT_SECRET` | dev-only value | **Required** in production, at least 32 characters (`openssl rand -base64 48`) |
| `DB_PASSWORD` | (none) | **Required.** PostgreSQL password (`openssl rand -hex 24`) |
| `MAGIDOC_HTTP_PORT` | `3000` | Local port your reverse proxy forwards to (bound to `127.0.0.1`) |
| `MAGIDOC_COOKIE_SECURE` | `true` (prod) | `Secure` flag on the session cookie. Keep it `true` behind HTTPS |
| `MAGIDOC_PROXY_BLOCK_PRIVATE` | `false` | Blocks the server-side runner from calling private or loopback IPs (SSRF protection). **Recommended on shared servers** |
| `MAGIDOC_JWT_EXPIRATION` | `7d` | Session lifetime |
| `MAGIDOC_CORS_ORIGINS` | `http://localhost:*` | Allowed origins. Use exact origins in production |
| `SPRING_PROFILES_ACTIVE` | `dev` | `dev` uses H2, `prod` uses PostgreSQL (set by Docker Compose) |

### Operations

```bash
bash deploy/backup.sh                              # PostgreSQL dump into ./backups/
docker compose build && docker compose up -d --wait   # update after pulling new code
docker compose logs -f backend                     # follow backend logs
```

Database migrations (Flyway) run automatically on start-up. Open browser tabs show a *new version available* banner after a deploy.

---

## 🔐 Security

- **Sessions** are stored in an `HttpOnly`, `SameSite=Lax` cookie (also `Secure` in production), so page scripts can't read them.
  - API clients can still send `Authorization: Bearer <token>`.
- **CSRF protection:** every state-changing `/api` request without an `Authorization` header must include the `X-MagiDoc-Client` header.
- **Revocation:** these actions invalidate every existing session:
  - changing or resetting a password;
  - *Sign out of all devices*.
- **Email-free password recovery:** each user gets 10 one-time recovery codes, stored only as BCrypt hashes.
- **Brute-force protection:**
  - sign-in is throttled per account (5 failures per 15 minutes) and per IP (30 per 15 minutes);
  - recovery codes and join codes are throttled too;
  - failed sign-ins take the same time whether or not the account exists.
- **SSRF protection** for the server-side runner (`MAGIDOC_PROXY_BLOCK_PRIVATE`).
- **Hardened headers** from the frontend nginx: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` and `Permissions-Policy`.
- **Shared docs are sanitized:** they never contain auth values, sensitive headers or secret variables.

> The rate limiter keeps its state in memory for each instance. If you run several backend instances, use a shared store such as Redis.

---

## 🛠️ Development

### Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 6, TypeScript, Tailwind CSS v4, TanStack Query, Zustand, React Router 7, lucide-react |
| Backend | Spring Boot 3.5 (Java 17), Spring Security (JWT resource server), Spring Data JPA, Flyway, Springdoc OpenAPI |
| Database | H2 (development, zero setup) and PostgreSQL 16 (production) |
| Testing | JUnit 5 and MockMvc, Vitest, Playwright |
| Delivery | Docker Compose, nginx, GitHub Actions |

### Project structure

```
MagiDoc/
├── backend/                  Spring Boot API, package-by-feature:
│   └── src/main/java/com/magidoc/
│       ├── auth  user  security  config  common
│       ├── workspace  team  activity  share
│       ├── collection  environment  execution  history
│       └── websocket  snippet
│   └── src/main/resources/db/migration     Flyway SQL migrations
├── frontend/                 React + Vite single-page app
│   ├── src/{api,components,features,lib,pages,store}
│   ├── public/magidoc-agent.mjs            the Local Agent
│   └── e2e/                                Playwright tests and fixtures
├── deploy/                   server guide, nginx config, backup script
├── docker-compose.yml        PostgreSQL + backend + frontend
└── .github/workflows/ci.yml  CI pipeline
```

### Tests

```bash
cd backend  && mvn test                 # API integration and unit tests (H2 in memory)
cd frontend && npm test                 # Vitest unit tests
cd frontend && npm run build            # type-check and production build
cd frontend && npx playwright test      # end-to-end tests (starts the backend and Vite itself)

E2E_BASE_URL=http://localhost:5173 npx playwright test   # reuse servers you already run
E2E_EXTERNAL=1 npx playwright test                       # also run tests that need the internet
```

CI runs the backend tests, the frontend build and the Playwright suite on every push and pull request. It uploads traces when an end-to-end test fails.

### Contributing
1. Create a branch from `main`.
2. Keep changes focused and add tests for new behaviour.
3. Make sure `mvn test`, `npm test`, `npm run build` and `npx playwright test` all pass.
4. Open a pull request with a clear description of what changed and why.

---

## 🗺️ Roadmap

- [ ] Pre-request and test scripts
- [ ] Mock servers
- [ ] GraphQL, Socket.IO and Server-Sent Events
- [ ] OAuth 2.0 helpers
- [ ] Real-time co-editing and comments on requests
- [ ] Request version history
- [ ] Join codes for teams
- [ ] SSO

---

## 👨‍💻 Developer

<table>
  <tr>
    <td align="center">
      <b>Eesara Megasooriya</b><br />
      Designer and developer of MagiDoc<br /><br />
      <a href="https://www.eesara.com"><img src="https://img.shields.io/badge/Website-www.eesara.com-6d4aff?style=for-the-badge&logo=googlechrome&logoColor=white" alt="www.eesara.com" /></a>
      <a href="https://github.com/EesaraMegasooriya"><img src="https://img.shields.io/badge/GitHub-EesaraMegasooriya-181717?style=for-the-badge&logo=github&logoColor=white" alt="GitHub profile" /></a>
    </td>
  </tr>
</table>

If MagiDoc helps you, consider giving the repository a ⭐.

<p align="center"><sub>Built with ❤️ by <a href="https://www.eesara.com">Eesara Megasooriya</a></sub></p>
