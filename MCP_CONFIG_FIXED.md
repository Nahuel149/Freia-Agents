# MCP configuration (fixed paths, no more timeouts)

The previous MCP snippet pointed at non-existent `bin/cli.js` entry points and tried to `npx` packages, so each client died during the handshake (`connection closed: initialize response`). This version only references MCP servers that are already installed in the repo (`dist/index.js` entrypoints) and disables anything that needs external credentials by default.

Copy this into your MCP client config (for the Freia repo), then flip `disabled` to `false` once you have the right env vars or services running:

```toml
model = "gpt-5.1-codex-max"
model_reasoning_effort = "medium"

[projects."/mnt/c/Users/nahue/Desktop/Freia"]
trust_level = "trusted"

approval_policy = "on-request"
model_reasoning_effort = "high"
model_reasoning_summary = "detailed"

# Installed MCP servers (paths are local to this repo)
[mcp_servers."sequential-thinking"]
command = "node"
args = [
  "./node_modules/@modelcontextprotocol/server-sequential-thinking/dist/index.js"
]
disabled = false # works offline, so enabled by default

[mcp_servers.PostgreSQL]
command = "node"
args = [
  "./node_modules/@modelcontextprotocol/server-postgres/dist/index.js",
  "{{env:POSTGRES_URL}}"
]
env = { POSTGRES_URL = "postgres://localhost:5432/postgres?sslmode=disable" }
disabled = true

[mcp_servers.BraveSearch]
command = "node"
args = [
  "./node_modules/@modelcontextprotocol/server-brave-search/dist/index.js"
]
env = { BRAVE_API_KEY = "{{env:BRAVE_API_KEY}}" }
disabled = true

[mcp_servers.Github]
command = "node"
args = [
  "./node_modules/@modelcontextprotocol/server-github/dist/index.js"
]
env = { GITHUB_TOKEN = "{{env:GITHUB_TOKEN}}" }
disabled = true

[mcp_servers.Slack]
command = "node"
args = [
  "./node_modules/@modelcontextprotocol/server-slack/dist/index.js"
]
env = { SLACK_BOT_TOKEN = "{{env:SLACK_BOT_TOKEN}}", SLACK_TEAM_ID = "{{env:SLACK_TEAM_ID}}" }
disabled = true

[notice]
hide_gpt5_1_migration_prompt = true
hide_gpt-5.1-codex-max_migration_prompt = true
```

Notes:
- Keep running MCPs in the repo root so the relative `./node_modules/...` paths resolve. If you move the repo, update the paths accordingly.
- Enable PostgreSQL, Brave, Github, or Slack only after setting their env vars; otherwise the servers exit immediately and the client handshake fails.
- If you need MongoDB/Playwright/MySQL, install those MCP servers first, add matching blocks, and keep them disabled until credentials and services are ready.
