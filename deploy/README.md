# Deploying MagiDoc on your server

For an Ubuntu/Debian server that **already runs nginx**. MagiDoc runs in Docker and listens only on `127.0.0.1:3000`; your nginx serves it on your domain with a free Let's Encrypt HTTPS certificate.

```
Internet ──HTTPS──▶ your nginx ──▶ 127.0.0.1:3000 ──▶ [frontend] ──▶ [backend] ──▶ [postgres]
                    (certbot)                         └──────── Docker Compose ────────┘
```

Replace `magidoc.example.com` with your domain throughout.

## Before you start

- **DNS:** create an `A` record (and `AAAA` if you use IPv6) for your domain pointing to the server. Check with `dig +short magidoc.example.com`.
- **Resources:** about 2 GB RAM free is enough to run. The first build compiles the Java and JavaScript code and needs about 2 GB RAM and 2 GB disk.
- **Ports:** nothing new is opened to the internet. Only nginx's 80/443 are used.

## 1. Install Docker

Follow the official guide for your OS: <https://docs.docker.com/engine/install/ubuntu/> (Debian: `/install/debian/`). Then check:

```bash
docker --version && docker compose version
sudo usermod -aG docker $USER   # optional: run docker without sudo (log out and back in)
```

## 2. Get the code

```bash
sudo mkdir -p /opt/magidoc && sudo chown $USER /opt/magidoc
git clone <your-repo-url> /opt/magidoc      # or copy the project folder there with scp/rsync
cd /opt/magidoc
```

## 3. Configure

```bash
cp .env.example .env
chmod 600 .env
openssl rand -base64 48   # paste as MAGIDOC_JWT_SECRET
openssl rand -hex 24      # paste as DB_PASSWORD
nano .env                 # also set MAGIDOC_PUBLIC_URL=https://magidoc.example.com
```

If port 3000 is already taken on the server, change `MAGIDOC_HTTP_PORT` and use the same port in the nginx config below.

## 4. Start MagiDoc

```bash
docker compose up -d --build        # first build takes a few minutes
docker compose ps                   # all three should become "healthy"
curl -sI http://127.0.0.1:3000 | head -1   # → HTTP/1.1 200 OK
```

Database tables are created automatically on first start.

## 5a. Using a Cloudflare Tunnel instead (no nginx, no port forwarding)

If the server already runs `cloudflared` as a dashboard-managed tunnel, skip steps 5 and 6. Cloudflare provides HTTPS.

1. Cloudflare dashboard → **Zero Trust → Networks → Tunnels** → your tunnel → **Public hostnames → Add a public hostname**.
2. Subdomain `magidoc`, domain `yourdomain.com`, type **HTTP**, URL **`localhost:3000`** → Save.
3. Make sure `MAGIDOC_PUBLIC_URL` in `.env` is `https://magidoc.yourdomain.com`, then run `docker compose up -d`.

The DNS record is created automatically, and the site is live within a minute.

## 5. Connect your nginx

```bash
sudo cp deploy/nginx-magidoc.conf /etc/nginx/sites-available/magidoc
sudo nano /etc/nginx/sites-available/magidoc          # set server_name to your domain
sudo ln -s /etc/nginx/sites-available/magidoc /etc/nginx/sites-enabled/magidoc
sudo nginx -t && sudo systemctl reload nginx
```

## 6. Turn on HTTPS

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d magidoc.example.com --redirect
```

Certbot adds the HTTPS server block and the http→https redirect, and renews the certificate automatically.

Once HTTPS works, enable HSTS. Add this line inside the `listen 443` server block that certbot created, then reload nginx:

```nginx
add_header Strict-Transport-Security "max-age=31536000" always;
```

**HTTPS is required.** The session cookie is `Secure`, so signing in won't work over plain `http://`.

## 7. First login

1. Open `https://magidoc.example.com` and create your account.
2. **Account menu → Security & recovery → Create recovery codes.** Store them somewhere safe. MagiDoc sends no emails, so these codes are the only way to reset a forgotten password.
3. Invite teammates: Workspace → **Invite** → create a **join code** and share it.

> **Registration is open.** Anyone who can reach the URL can create an account, but they only see workspaces they're added to or join with a code. If the server should be private, restrict access in nginx (allow-listed IPs, VPN or basic auth), or ask for a "disable sign-up / allowed email domains" setting.

## 8. Backups

```bash
./deploy/backup.sh                 # writes backups/magidoc-YYYYMMDD-HHMMSS.dump, keeps 14 days
crontab -e                         # daily at 03:00:
0 3 * * * cd /opt/magidoc && ./deploy/backup.sh >> backups/backup.log 2>&1
```

Also copy `backups/` to another machine or to storage (e.g. `rsync` or `rclone` in cron). A backup on the same disk doesn't survive a disk failure.

**Restore** (this replaces the current data):

```bash
docker compose exec -T postgres pg_restore -U magidoc -d magidoc --clean --if-exists --no-owner < backups/magidoc-XXXX.dump
docker compose restart backend
```

## 9. Updating

```bash
cd /opt/magidoc
./deploy/backup.sh                 # always back up first
git pull
docker compose up -d --build       # database migrations run automatically
docker image prune -f              # free space from old images
```

## Operations

| Task | Command |
|---|---|
| Status | `docker compose ps` |
| Logs | `docker compose logs -f backend` (or `frontend`, `postgres`) |
| Restart | `docker compose restart backend` |
| Stop / start | `docker compose down` / `docker compose up -d` (data is kept in the `pgdata` volume) |
| Database shell | `docker compose exec postgres psql -U magidoc magidoc` |

**Never** run `docker compose down -v` on the server: `-v` deletes the database volume.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `502 Bad Gateway` | MagiDoc isn't up yet or crashed: `docker compose ps`, then `docker compose logs backend`. |
| Sign-in "works" but you're immediately logged out | Site opened over `http://`. Use `https://`; the session cookie is `Secure`. (`MAGIDOC_COOKIE_SECURE=false` is only for a plain-http test.) |
| `Requests to private network addresses are disabled` when sending a request | SSRF protection: the request runner can't call your server's internal services or private IPs. To test internal APIs on purpose, set `MAGIDOC_PROXY_BLOCK_PRIVATE=false` and run `docker compose up -d`. Only do this if you trust every user. |
| `Set DB_PASSWORD in .env` on startup | `.env` is missing a required value (see step 3). |
| Build killed / very slow | Not enough RAM for the build. Add swap, or build the images on another machine and push them to a registry. |
| "Too many attempts" when signing in | Rate limiting after repeated wrong passwords. Wait 15 minutes. |
