# Deployment guide

## Railway (recommended)

### 1. Create a new Railway project

```
railway login
railway init
```

Or click **New Project → Deploy from GitHub repo** in the Railway dashboard and select this repository.

### 2. Add a Postgres plugin

In the Railway dashboard open your project, click **+ New** → **Database** → **Add PostgreSQL**. Railway injects `DATABASE_URL` automatically into all services in the same project.

### 3. Set environment variables

In **Settings → Variables** add:

| Variable | Required | Example | Notes |
|---|---|---|---|
| `GITHUB_TOKEN` | Yes | `ghp_…` | Fine-grained PAT with repo read scope. Add write scope if `ALLOW_WRITES=true`. |
| `GITHUB_ORG` | Yes | `acme-corp` | GitHub organisation slug. |
| `ALLOWED_REPOS` | No | `api,frontend` | Comma-separated repo names. `*` (default) allows all repos in the org. |
| `ALLOW_WRITES` | No | `false` | Set to `true` to enable write tools (create branch, push commit, create PR, create release). Keep `false` until the team is ready. |
| `LOG_LEVEL` | No | `info` | `debug` \| `info` \| `warn` \| `error` |
| `PORT` | No | `3000` | Railway sets this automatically. Enables HTTP+SSE transport when present. |
| `DATABASE_URL` | No | *(injected by Railway Postgres plugin)* | Enables audit logging. Omit to run without a database. |

> `DATABASE_URL` is injected automatically when the Postgres plugin is in the same Railway project — you do not need to set it manually.

### 4. Health check

Railway uses the path configured in `railway.toml`:

```
healthcheckPath = "/health"
```

The server exposes `GET /health` on the HTTP transport (requires `PORT` to be set). If the health check fails, Railway retries up to 3 times before marking the deploy as failed.

### 5. Deploy

```
railway up
```

Or push to the linked GitHub branch — Railway redeploys automatically on every push.

---

## Docker Compose (local / self-hosted)

### 1. Copy and edit the env file

```bash
cp .env.example .env
# Edit .env — set GITHUB_TOKEN and GITHUB_ORG at minimum
```

### 2. Start the stack

```bash
docker compose up --build
```

This starts:
- **mcp** — the MCP server on `http://localhost:3000`
- **postgres** — Postgres 16, data persisted in a named volume

The MCP service waits for Postgres to pass its health check before starting.

### 3. Health check

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{"status":"ok","uptime":…,"tools":…,"version":"0.1.0"}
```

### 4. Stop and clean up

```bash
docker compose down          # stop containers, keep volume
docker compose down -v       # stop containers and delete volume
```

---

## Stdio transport (Claude Desktop / MCP clients)

For local use without HTTP, run the server directly. Claude Desktop example config:

```json
{
  "mcpServers": {
    "github-workflow": {
      "command": "node",
      "args": ["/path/to/github-workflow-mcp/dist/server.js"],
      "env": {
        "GITHUB_TOKEN": "ghp_…",
        "GITHUB_ORG": "acme-corp"
      }
    }
  }
}
```

Do not set `PORT` — omitting it disables HTTP and the server uses stdio only.

---

## Database schema

When `DATABASE_URL` is set the server creates the audit table automatically on startup:

```sql
CREATE TABLE IF NOT EXISTS audit_log (
  id         BIGSERIAL PRIMARY KEY,
  ts         TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor      TEXT NOT NULL,
  tool       TEXT NOT NULL,
  repo       TEXT,
  payload    JSONB,
  result     TEXT NOT NULL
);
```

No migration tool is needed — `CREATE TABLE IF NOT EXISTS` is idempotent.
