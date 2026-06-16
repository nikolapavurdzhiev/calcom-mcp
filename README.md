# calcom-mcp

[![npm version](https://img.shields.io/npm/v/@reckit/calcom-mcp.svg)](https://www.npmjs.com/package/@reckit/calcom-mcp)
[![license: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
[![Node >= 18](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)

A local **MCP server** that lets an AI agent (Claude Desktop, Claude Code, Cursor, or any [Model Context Protocol](https://modelcontextprotocol.io) client) manage your **[Cal.com](https://cal.com) / [Cal.eu](https://cal.eu)** scheduling account: read and create bookings, manage event types, check availability, edit schedules, list calendars, and configure webhooks. It talks to the official **Cal v2 API**.

> **Why this exists:** Cal.com ships its own hosted MCP, but it targets the US data region and the **EU region (`cal.eu`) is not well supported there yet**. This server **defaults to the EU host** so EU users get something that works out of the box, while staying fully usable for **US and self-hosted** accounts with one environment variable. See [Choosing your region](#choosing-your-region).

---

## Table of contents

- [What you get](#what-you-get)
- [Choosing your region (EU / US / self-hosted)](#choosing-your-region)
- [Get your Cal API key](#get-your-cal-api-key)
- [Quick start](#quick-start)
- [Let your AI agent install it for you](#let-your-ai-agent-install-it-for-you)
- [Configuration](#configuration)
- [Connect it to a client](#connect-it-to-a-client)
- [Tools](#tools)
- [Security & privacy](#security--privacy)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

---

## What you get

- A **generic** `cal_api_request` tool for full API coverage (any method, any v2 path), so your agent can reach endpoints that aren't individually wrapped.
- **Strongly-named convenience tools** for the common workflows: profile, bookings, event types, availability/slots, schedules, calendars, and webhooks ([full list](#tools)).
- **EU-first defaults** (`https://api.cal.eu`), per-endpoint `cal-api-version` handling, robust structured errors, and **no API-key leakage** in logs, errors, or responses.
- Runs **locally over stdio** — your API key stays on your machine and is sent only to Cal's API over HTTPS. Nothing is proxied through a third party.

## Choosing your region

Cal runs separate **data regions**, each with its own API host. **Your API key only works against the region where your account lives.** Pick the host that matches where you signed up:

| Your account | `CALCOM_BASE_URL` to use | Do you need to set it? |
|--------------|--------------------------|------------------------|
| **Cal.eu (EU region)** | `https://api.cal.eu` | No — this is the **default**. |
| **Cal.com (US / global)** | `https://api.cal.com` | **Yes** — set this variable. |
| **Self-hosted Cal** | `https://<your-domain>/api/v2` *(or your API host)* | **Yes** — set it to your instance's API base. |

> **US (cal.com) users — this is the one thing you must change.** Everything else in this README is identical for you; just add `CALCOM_BASE_URL=https://api.cal.com` to your configuration. If you skip it, the server will try the EU host and your US key will fail to authenticate (you'll see a `401 unauthorized`).
>
> **Self-hosters:** set `CALCOM_BASE_URL` to your instance's v2 API base. The `cal-api-version` dates this server uses match Cal's public schema; if your fork pins different versions, override per call with the `apiVersion` argument or via `CALCOM_API_VERSION`.

## Get your Cal API key

1. Sign in to **[app.cal.com](https://app.cal.com)** (US) or **[app.cal.eu](https://app.cal.eu)** (EU).
2. Go to **Settings → Developer → API keys** (sometimes shown under the Security tab).
3. Create a key. Live keys are prefixed `cal_live_…`; test keys are prefixed `cal_test_…`.
4. Copy it somewhere safe — you'll paste it into your config below. **Treat it like a password.**

## Quick start

You need **Node.js 18+** (`node --version`). There are two ways to run it.

### Option A — run with `npx` (no clone, recommended)

You don't install anything manually. Your MCP client launches it on demand. Skip to [Connect it to a client](#connect-it-to-a-client) and use the `npx` config. To confirm it runs at all:

```bash
# EU account (default):
CALCOM_API_KEY=cal_live_xxx npx -y @reckit/calcom-mcp

# US account:
CALCOM_API_KEY=cal_live_xxx CALCOM_BASE_URL=https://api.cal.com npx -y @reckit/calcom-mcp
```

It will start and wait for a client over stdio (there's no interactive prompt — press `Ctrl+C` to stop). On Windows PowerShell:

```powershell
$env:CALCOM_API_KEY="cal_live_xxx"; npx -y @reckit/calcom-mcp
```

### Option B — clone and build (for development or pinning a version)

```bash
git clone https://github.com/nikolapavurdzhiev/calcom-mcp.git
cd calcom-mcp
npm install
npm run build          # compiles TypeScript into dist/
cp .env.example .env.local   # then edit .env.local with your real key
npm start              # node dist/index.js
```

## Let your AI agent install it for you

Don't want to touch config files yourself? **Copy the prompt below and paste it to Claude Desktop, Claude Code, Cursor, or any agent that can edit files**, then follow along. Replace the key (and uncomment the US line if you're on cal.com).

> **Please install the `calcom-mcp` MCP server for me so I can manage my Cal.com scheduling from here.**
>
> 1. Make sure Node.js 18+ is installed (`node --version`). If it isn't, tell me how to install it and stop.
> 2. Add a new MCP server named `calcom` to my MCP client's config. Use `npx` so nothing needs to be cloned:
>    - command: `npx`, args: `["-y", "@reckit/calcom-mcp"]`
>    - environment variable `CALCOM_API_KEY` = `cal_live_REPLACE_WITH_MY_KEY`
>    - **I am in the EU (cal.eu), so do NOT set CALCOM_BASE_URL — the default is correct.**
>    - *(If I am in the US/global on cal.com instead, also set `CALCOM_BASE_URL` = `https://api.cal.com`.)*
> 3. For Claude Desktop, edit `claude_desktop_config.json` (Settings → Developer → Edit Config; on Windows it's at `%APPDATA%\Claude\claude_desktop_config.json`). For Claude Code, run the equivalent `claude mcp add` command. For Cursor, edit its MCP settings file.
> 4. Show me the exact JSON you added, then tell me to fully restart the app.
> 5. After I restart, ask me to run "list my upcoming Cal bookings" so we can confirm the tools work.
>
> Keep my API key out of any file you commit or share, and never print the full key back to me.

## Configuration

Set these via your MCP client's `env` block, your shell, or a **`.env.local`** file in the project root (Option B only). See [`.env.example`](./.env.example).

When you clone, the server auto-loads `.env.local` (then `.env`) from the project root on startup. **Variables already in the environment always win**, so a client `env` block overrides the file. `.env.local` and `.env` are **gitignored** — never commit a real key.

| Variable             | Required | Default               | Purpose |
|----------------------|----------|-----------------------|---------|
| `CALCOM_API_KEY`     | **yes**  | —                     | Sent as `Authorization: Bearer <key>`. |
| `CALCOM_BASE_URL`    | no       | `https://api.cal.eu`  | API host. **US users set `https://api.cal.com`.** See [Choosing your region](#choosing-your-region). |
| `CALCOM_API_VERSION` | no       | per-endpoint (below)  | Fallback `cal-api-version`. |
| `CALCOM_TIMEOUT_MS`  | no       | `30000`               | Per-request timeout in ms. |
| `CALCOM_DEBUG`       | no       | off                   | `1`/`true` logs redacted request info to **stderr**. |

### How `cal-api-version` is chosen

Cal pins endpoint behaviour to a dated header, and endpoint families were introduced on different dates. Resolution order (first defined wins):

1. A per-call `apiVersion` argument (every tool accepts one).
2. The endpoint family's known-good default: event-types → `2024-06-14`, bookings → `2024-08-13`, slots → `2024-09-04`, schedules → `2024-06-11`, everything else → `2024-08-13`.
3. `CALCOM_API_VERSION` (env fallback).
4. Built-in default `2024-08-13`.

The env value is a **fallback, not an override**: setting it won't silently break a booking call that needs a newer version than event-types. To force a version on one call, pass `apiVersion` or use `cal_api_request`.

## Connect it to a client

The server speaks MCP over **stdio**. All diagnostics go to **stderr**; stdout is reserved for the protocol. It's launched by an MCP client, not used interactively.

### Claude Desktop

Edit `claude_desktop_config.json` (Claude Desktop → Settings → Developer → Edit Config). On Windows it lives at `%APPDATA%\Claude\claude_desktop_config.json`; on macOS at `~/Library/Application Support/Claude/claude_desktop_config.json`.

**Using `npx` (no clone) — EU account:**

```json
{
  "mcpServers": {
    "calcom": {
      "command": "npx",
      "args": ["-y", "@reckit/calcom-mcp"],
      "env": {
        "CALCOM_API_KEY": "cal_live_xxxxxxxxxxxxxxxxxxxx"
      }
    }
  }
}
```

**US account** — add the base URL:

```json
{
  "mcpServers": {
    "calcom": {
      "command": "npx",
      "args": ["-y", "@reckit/calcom-mcp"],
      "env": {
        "CALCOM_API_KEY": "cal_live_xxxxxxxxxxxxxxxxxxxx",
        "CALCOM_BASE_URL": "https://api.cal.com"
      }
    }
  }
}
```

> **Windows note:** if Claude can't find `npx`, use `"command": "cmd"` with `"args": ["/c", "npx", "-y", "@reckit/calcom-mcp"]`.

**Using a local clone (Option B)** — point at the built entry file with an absolute path and escaped backslashes on Windows:

```json
{
  "mcpServers": {
    "calcom": {
      "command": "node",
      "args": ["C:\\path\\to\\calcom-mcp\\dist\\index.js"],
      "env": { "CALCOM_API_KEY": "cal_live_xxxxxxxxxxxxxxxxxxxx" }
    }
  }
}
```

After editing the config, **fully restart Claude Desktop**. The `calcom` tools then appear in the tools menu.

### Claude Code

```bash
claude mcp add calcom --env CALCOM_API_KEY=cal_live_xxx -- npx -y @reckit/calcom-mcp
# US: add  --env CALCOM_BASE_URL=https://api.cal.com
```

### Any other MCP client (Cursor, generic)

Use the same idea: `command: "npx"`, `args: ["-y", "@reckit/calcom-mcp"]`, and an `env` block with `CALCOM_API_KEY` (plus `CALCOM_BASE_URL` for US/self-hosted). For a local clone, run `node /absolute/path/to/calcom-mcp/dist/index.js`.

### Smoke test (uses your real key, read-only)

From a clone:

```bash
# bash
CALCOM_API_KEY=cal_live_xxx npm run smoke
# PowerShell
$env:CALCOM_API_KEY="cal_live_xxx"; npm run smoke
```

It safely calls `GET /v2/me`, `GET /v2/event-types`, and `GET /v2/bookings?status=upcoming&limit=5`, then prints a concise summary. **The API key is never printed.**

## Tools

Every tool returns a structured JSON result:

```jsonc
{
  "success": true,
  "status_code": 200,
  "data": { /* ... */ },
  "request": { "method": "GET", "url": "https://api.cal.eu/v2/me", "path": "/v2/me", "apiVersion": "2024-08-13", "hasBody": false }
}
```

…or on failure, `success: false` with a redacted `error: { type, message, details }`.

**Generic** — `cal_api_request` (`method`, `path` starting with `/`, `query`, `body`, `apiVersion?`, `idempotencyKey?`; only contacts `CALCOM_BASE_URL`, external URLs are rejected).

**Account** — `cal_get_me`.

**Bookings** — `cal_list_bookings`, `cal_get_booking`, `cal_create_booking`, `cal_cancel_booking`, `cal_reschedule_booking`, `cal_mark_booking_no_show`.

**Event types** — `cal_list_event_types`, `cal_get_event_type` (graceful **403/404 fallback** to list-and-filter), `cal_get_event_type_settings_summary`, `cal_find_event_type_by_slug`, `cal_create_event_type`, `cal_update_event_type`, `cal_delete_event_type`, `cal_duplicate_event_type`.

**Availability / slots** — `cal_get_available_slots` (alias `cal_get_availability`).

**Schedules** — `cal_list_schedules`, `cal_get_schedule`, `cal_get_default_schedule`, `cal_create_schedule`, `cal_update_schedule`, `cal_delete_schedule`.

**Calendars** — `cal_list_calendars`, `cal_get_calendar_busy_times`.

**Webhooks** — `cal_list_webhooks`, `cal_get_webhook`, `cal_create_webhook`, `cal_update_webhook`, `cal_delete_webhook`.

> Teams/orgs/users/forms/routing/workflows don't have dedicated tools (their availability depends on plan and key scope), but they're fully reachable through `cal_api_request` — e.g. `cal_api_request { method: "GET", path: "/v2/teams" }`. Unsupported endpoints return a structured error, not a crash.

### Error handling

Errors are mapped, redacted, and never fatal to the server: `400 bad_request`, `401 unauthorized` ("verify CALCOM_API_KEY"), `403 forbidden` (auto-fallback for `cal_get_event_type`), `404 not_found`, `409/422 conflict/unprocessable_entity`, `429 rate_limited`, `5xx server_error`, plus `timeout`, `network_error`, and `invalid_path` (bad/external URLs rejected before any request). The API key is stripped from every message, error `details` (deeply), and debug log.

## Security & privacy

- **Your key never leaves your machine** except in the `Authorization` header sent directly to Cal's API over HTTPS. There is no middleman server.
- The key is **redacted** from all logs, error messages, error details, and responses.
- **Keep your key out of git.** Use your client's `env` block or a `.env.local` file (which is gitignored). Never paste a live key into a file you commit.
- Tools that **write** (create/cancel/reschedule bookings, edit event types/schedules, manage webhooks) act with the full power of your key. Review what your agent does, especially the first time.
- If you suspect your key leaked, **revoke it** in Cal's Developer settings and create a new one.

## Development

```bash
npm install
npm run build      # tsc -> dist/
npm test           # vitest, all HTTP mocked, no real key needed
npm run typecheck
```

Tests cover env loading, URL/header building, the `https://api.cal.eu` default, API-key redaction, list parsing, the 403 → list/filter fallback, generic POST bodies, invalid-path rejection, non-2xx formatting, and a full MCP client↔server round-trip over an in-memory transport.

### Project layout

```
src/
  index.ts          # entry: load config, build server, register tools, stdio transport
  config.ts         # env parsing + validation
  calClient.ts      # HTTP client: URL/headers/timeout, redaction, structured errors
  apiVersions.ts    # per-endpoint cal-api-version map + resolver
  env.ts            # dependency-free .env.local / .env loader
  types.ts          # shared result/request shapes
  smoke.ts          # manual read-only smoke test
  tools/            # defineTool() factory + one module per tool family
test/               # vitest suites (mocked HTTP + in-memory MCP round-trip)
```

Add a convenience tool by exporting a `defineTool({ name, title, description, schema, handler })` from a module in `src/tools/` and including it in `src/tools/index.ts`. Until then, the agent can already use any endpoint via `cal_api_request`.

## Contributing

Issues and pull requests are welcome. Please run `npm test` and `npm run typecheck` before opening a PR, and don't include any real API keys or personal data in code, tests, or fixtures.

## License

[MIT](./LICENSE)
