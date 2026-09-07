# KooyaHQ AI client tutorials

Install and configure the KooyaHQ CLI first. The local MCP server is a stdio process, so it runs on the same computer as the AI client and uses that computer's KooyaHQ profile. It never exposes the profile to a browser or hosted agent.

## Shared preparation

On Linux, macOS, or Windows, install Node.js 18 or newer, Git, and the private CLI package. Then configure and verify the local profile:

```sh
npm install -g --install-links=true --ignore-scripts git+https://github.com/KooyaPH/kooyahq_mcp_cli.git#v0.1.0
kooyahq configure
kooyahq auth whoami --output json
```

For a manual stdio entry, obtain absolute targets. On Windows, use forward slashes when placing paths in JSON.

```sh
node -p "process.execPath"
npm root -g
```

Every JSON-backed installer writes the local server below its `mcpServers.kooyahq` entry. The entry always uses the Node.js path as `command` and this script as its only argument:

```text
<npm-global-root>/kooyahq-cli/dist/bin/kooyahq-mcp.js
```

## Cursor

Run this on the same operating system as the target Cursor client. Cursor desktop and Cursor Agent can share `~/.cursor/mcp.json` only when they use the same OS home directory:

```sh
kooyahq mcp install --client cursor
kooyahq mcp doctor --client cursor --online
cursor-agent mcp list
cursor-agent mcp list-tools kooyahq
```

Restart the Cursor desktop app after installation. The expected tools are `kooyahq_status`, `kooyahq_discover`, and `kooyahq_call`.

See [the Cursor tutorial](cursor.md) for recovery and safe use.

## Claude Code

```sh
kooyahq mcp install --client claude
claude mcp get kooyahq
```

See [the Claude Code tutorial](claude.md). Claude's lookup is text-only, so its KooyaHQ doctor deliberately fails closed instead of claiming an exact descriptor check. Claude.ai web connectors require a remote MCP gateway; they cannot start this local process.

## Gemini CLI

```sh
kooyahq mcp install --client gemini
kooyahq mcp doctor --client gemini --online
```

See [the Gemini CLI tutorial](gemini.md). Keep tool approval enabled; do not set the server to trusted or auto-run.

## Google Antigravity

```sh
kooyahq mcp install --client antigravity
kooyahq mcp doctor --client antigravity --online
```

See [the Google Antigravity tutorial](antigravity.md).

## OpenClaw

```sh
kooyahq mcp manual --client openclaw
```

See [the OpenClaw tutorial](openclaw.md). This prints the absolute local descriptor without modifying OpenClaw; apply it through OpenClaw's reviewed registry workflow.

## Hermes Agent

```sh
kooyahq mcp manual --client hermes
```

See [the Hermes Agent tutorial](hermes.md). This prints the absolute YAML entry without modifying Hermes. Do not use `hermes import-agent` with secret migration: the KooyaHQ profile remains managed only by `kooyahq configure`.

## Safe workflow for every local client

1. Call `kooyahq_status` to establish the acting identity.
2. Call `kooyahq_discover` for the exact command.
3. Call `kooyahq_call` with `command: "projects list"` and `all: true`.
4. Read the target board or ticket with an exact selector.
5. Dry-run a mutation with the exact returned project display name, `confirm: true`, and `dryRun: true`.
6. Perform the same mutation with `confirm: true` and the same `project` value.
7. Read back the result and clean up temporary test data.

All non-GET MCP calls enforce the live project catalog. `project` must exactly equal a name returned by `projects list`; unmatched projects and MCP project creation are rejected. The bridge still requires backend authorization and a mutation confirmation.

## ChatGPT, Replit, and other web environments

ChatGPT remote MCP, OpenAI Responses API, Replit Agent, Gemini web/API, and Claude.ai web connectors are remote environments. **Remote gateway required:** the local `kooyahq-mcp` process cannot be installed into them and no `kooyahq mcp install --client chatgpt` or `--client replit` command exists.

Before documenting a web installation, KooyaHQ must deploy a separately reviewed HTTPS Streamable HTTP or SSE MCP gateway with per-user authentication, backend-enforced project validation, approval controls, rate limits, audit events, health checks, and credential-revocation procedures. Never tunnel or expose a developer's local KooyaHQ profile. See [the hosted-client boundary](web-and-remote.md).

## Recovery

If a client reports a missing executable, reinstall the CLI, regenerate its entry with the appropriate installer or manual configuration, then restart the client. If `kooyahq mcp doctor --client cursor --online` fails, re-run `kooyahq configure`; never paste the secret into an MCP configuration file.
