# GitHub Workflow MCP

A [Model Context Protocol](https://modelcontextprotocol.io) server that gives AI agents structured, scoped access to your GitHub engineering workflow — read repositories, review pull requests, lint code, search your knowledge base, and (optionally) create branches and open PRs.

---

## What it does

Connect an AI agent to this server and it can:

- Browse repositories, files, and pull requests in your GitHub organisation
- Read and search issues assigned to the authenticated user
- Lint inline code, unified diffs, or entire PRs using your project's own ESLint and TypeScript config
- Query an engineering knowledge base (conventions, architecture, review checklists)
- Create branches, open PRs, request reviews, and merge — gated behind an explicit opt-in flag

All write operations are disabled by default and require `ALLOW_WRITES=true`. Every write is recorded in the audit log when a database is connected.

---

## Quick start

### Prerequisites

- Node.js ≥ 20
- A GitHub [fine-grained PAT](https://github.com/settings/tokens) with `repo` read scope (add write scope if you enable write tools)

### Install

```bash
git clone https://github.com/Wajkie/github-workflow-mcp
cd github-workflow-mcp
npm install
cp .env.example .env   # fill in GITHUB_TOKEN and GITHUB_ORG
```

### Run (stdio — for use with Claude Desktop or any MCP client)

```bash
npm run dev
```

### Run (HTTP — for remote deployment)

```bash
PORT=3000 npm run dev
# Server available at http://localhost:3000/mcp
```

### Connect to Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or the equivalent on your OS:

```json
{
  "mcpServers": {
    "github-workflow": {
      "command": "node",
      "args": ["/absolute/path/to/github-workflow-mcp/dist/server.js"],
      "env": {
        "GITHUB_TOKEN": "ghp_…",
        "GITHUB_ORG": "your-org"
      }
    }
  }
}
```

---

## Tools

| Category | Tools |
|---|---|
| **Repositories** | `list_repositories`, `get_repository`, `get_file`, `search_code` |
| **Work tracking** | `get_active_work`, `get_issue`, `search_issues` |
| **Pull requests** | `get_pr`, `get_changed_files` |
| **Releases** | `get_release_status`, `get_recent_deployments` |
| **Linting** | `lint_code`, `validate_diff`, `validate_pr`, `suggest_fixes`, `apply_safe_fixes` |
| **Knowledge** | `search_knowledge` |
| **Write** *(requires `ALLOW_WRITES=true`)* | `create_branch`, `create_pull_request`, `request_review`, `merge_pr` |

Full tool reference, inputs, outputs, and examples: see [`docs/docs.json`](docs/docs.json).

---

## Configuration

| Variable | Required | Default | Description |
|---|---|---|---|
| `GITHUB_TOKEN` | Yes | — | Fine-grained PAT |
| `GITHUB_ORG` | Yes | — | GitHub organisation slug |
| `ALLOWED_REPOS` | No | `*` | Comma-separated repo names, or `*` for all |
| `ALLOW_WRITES` | No | `false` | Set `true` to enable write tools |
| `LOG_LEVEL` | No | `info` | `debug` \| `info` \| `warn` \| `error` |
| `PORT` | No | — | Enables HTTP transport when set |
| `MCP_SECRET` | No | — | Shared secret required on `x-mcp-secret` header (HTTP only) |
| `MAX_BODY_BYTES` | No | `1048576` | Max HTTP request body size (bytes) |
| `MAX_SESSIONS` | No | `100` | Max concurrent HTTP sessions |
| `DATABASE_URL` | No | — | Postgres — enables audit logging and knowledge search |
| `REDIS_URL` | No | — | Redis — enables response caching |
| `CACHE_TTL_REPOS` | No | `300` | Repo cache TTL (seconds) |
| `CACHE_TTL_PRS` | No | `120` | PR cache TTL (seconds) |
| `CACHE_TTL_ISSUES` | No | `120` | Issue cache TTL (seconds) |
| `CACHE_TTL_FILES` | No | `600` | File cache TTL (seconds) |
| `METRICS_INTERVAL` | No | `100` | Emit metrics summary every N tool calls |

---

## Transports

| Mode | When | How |
|---|---|---|
| **stdio** | Local use, Claude Desktop | Default — omit `PORT` |
| **HTTP** | Remote deployment, Railway | Set `PORT` — exposes `/mcp` (StreamableHTTP) and `/health` |

Both transports can run simultaneously when `PORT` is set.

---

## Deployment

See [`docs/deployment.md`](docs/deployment.md) for Railway and Docker Compose instructions.

---

## Development

```bash
npm run dev          # run with tsx (no build step)
npm run build        # compile to dist/
npm test             # vitest
npm run lint         # eslint
npm run typecheck    # tsc --noEmit
npm run type-coverage
```

---

## Knowledge base

The `knowledge/` directory contains Markdown files served as MCP resources at `engineering:///<slug>`. Edit the files to give agents context about your team's conventions, architecture, and processes. No code changes required.

---

## Security

- Write tools are disabled by default (`ALLOW_WRITES=false`)
- All write operations are audit-logged when `DATABASE_URL` is set
- Repository access is scoped via `ALLOWED_REPOS`
- HTTP transport supports a shared secret (`MCP_SECRET`) and per-session caps
- Search queries are validated to prevent GitHub qualifier injection
