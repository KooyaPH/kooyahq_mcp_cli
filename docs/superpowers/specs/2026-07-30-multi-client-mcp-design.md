# Multi-client KooyaHQ MCP Design

**Status:** Approved for planning on 2026-07-30

## Goal

Make KooyaHQ usable from the major MCP-capable coding agents without weakening the company-internal project-catalog gate. Ship reliable local-client setup first; build a separately authenticated remote MCP gateway before claiming support for browser-only clients.

## Current facts

- `kooyahq-mcp` is a local newline-delimited stdio MCP server. It is not an HTTP, SSE, or Streamable HTTP service.
- The server uses the credential profile created by `kooyahq configure` on the same machine. It must never be exposed to a hosted agent or browser.
- `kooyahq mcp install --client codex` is the only current first-class installer. It writes absolute paths, installs the Codex skill, and has an offline/online doctor.
- MCP mutations require `confirm: true`, but the project-catalog workflow is currently delivered to Codex as a skill rather than enforced by the stdio server itself.

## Product boundaries

### Local MCP clients

The first release will support these locally installed clients:

| Client | Transport | Configuration scope | Required workflow surface |
| --- | --- | --- | --- |
| Codex | stdio | user | packaged Codex skill |
| Claude Code and Claude Desktop | stdio | user or project | client-native project instruction plus MCP entry |
| Cursor | stdio | user or project | `.cursor/rules` project instruction plus MCP entry |
| Gemini CLI | stdio | user or project | `GEMINI.md` project instruction plus MCP entry |
| Google Antigravity IDE/CLI | stdio | user or workspace | workspace instruction/plugin plus MCP entry |
| OpenClaw | stdio | OpenClaw MCP registry | managed MCP entry and workflow skill/instruction |
| Hermes Agent | stdio | user or project | Hermes MCP configuration and workflow skill |

Every installer must resolve and write absolute Node.js and `kooyahq-mcp` paths. It must preserve unrelated configuration, reject unreadable or ambiguous pre-existing `kooyahq` entries, and restore the previous entry if its own registration fails. It must install an equivalent project-catalog instruction rather than silently relying on Codex-only behavior.

### Browser and hosted clients

ChatGPT, the OpenAI Responses API, Replit Agent, Gemini web/API, and other hosted products are **not supported by the local CLI MCP server**. They require a new remote gateway with a public HTTPS Streamable HTTP or SSE endpoint. The local installer must never advertise them as installed or ready.

The remote gateway is a separate production system, with a separate security review and deployment. It must have:

- authenticated user identity rather than a copied local CLI profile;
- least-privilege authorization mapped to KooyaHQ backend permissions;
- backend-enforced project-catalog validation for mutations, not merely prompt instructions;
- per-call approval for mutations, durable audit events, rate limits, request-size limits, and output redaction;
- OAuth-compatible remote MCP transport, HTTPS, health checks, observability, and incident/credential-revocation runbooks.

No browser/client tutorial is published as an installation path until this gateway exists, is deployed, and passes live authentication and mutation-authorization tests.

## User experience

The README is the complete entry point. It will contain:

1. one CLI installation and configuration section for Linux, macOS, and Windows;
2. a client compatibility matrix with transport, support tier, required prerequisite, and verification command;
3. copyable client-specific local installation tutorials for the seven supported local clients;
4. an explicit hosted/web section that explains the remote-gateway prerequisite rather than showing unusable local commands;
5. one read scenario and one safe mutation scenario that always start with project discovery, use dry-run plus confirmation, verify the result, and clean up temporary data;
6. troubleshooting for missing executables, stale registrations, profile/authentication failure, and unavailable remote support.

Detailed manuals live under `docs/ai-clients/`, one focused page per client plus a remote-gateway status page. README content links there without requiring the user to infer configuration paths or copy a generic `kooyahq-mcp` command that can break outside an interactive shell.

## Implementation design

Create a data-driven local-client setup layer under `src/mcp/setup/` so the command parser accepts explicit client names and delegates each client to a focused installer. Keep Codex behavior unchanged behind its existing installer. Each new installer owns only its client configuration format, instruction placement, rollback logic, and doctor checks.

The shared layer resolves the installed package root and Node executable once, produces a single absolute stdio transport descriptor, removes credentials from child processes, and exposes a common local MCP handshake probe. It must not write secrets into any client configuration file.

Each client doctor validates, in order: readable absolute targets, the exact registered stdio descriptor, the local MCP handshake and three-tool list, the required project-gate instruction artifact, and optionally the authenticated KooyaHQ profile. The CLI help and all manuals must describe exactly the clients actually implemented; an unsupported client fails before changing files.

## Testing and release criteria

- Write a failing test for each newly accepted client name before implementing it.
- Add fixture-driven tests for install, idempotence, preservation of unrelated configuration, ambiguous-config refusal, rollback, absolute targets, and no-secret output for every client format.
- Add tests that each installed workflow artifact contains the exact project-list gate, no-mutation-on-missing-project rule, discovery requirement, dry-run/confirmation requirement, verification, and cleanup requirement.
- Add documentation contract tests for every supported local tutorial and every remote-only warning.
- Run the full CLI suite, typecheck, build, package/install smoke test, and the appropriate installed-client doctor on the release workstation.
- Keep macOS and Windows installation execution as real hosted-smoke coverage when runner capacity is enabled; do not replace it with documentation-only claims.
- Release local clients only after a PR review and checks pass. Remote-gateway work requires its own plan, security review, deployment PR, and post-deploy verification.

## Non-goals

- Do not add a generic "all AI tools" installer. Only documented, verified client formats are supported.
- Do not expose the stdio server through a tunnel as a substitute for authentication and authorization.
- Do not store KooyaHQ keys in client configuration files, browser storage, prompts, or checked-in project files.
- Do not make the existing three-tool MCP surface larger merely to satisfy a client-specific configuration format.

## External compatibility references

- Claude Code MCP: <https://docs.anthropic.com/en/docs/claude-code/mcp>
- Cursor MCP: <https://docs.cursor.com/context/model-context-protocol>
- Gemini CLI MCP: <https://geminicli.com/docs/tools/mcp-server/>
- Google Antigravity MCP: <https://antigravity.google/docs/mcp>
- OpenClaw MCP: <https://docs.openclaw.ai/cli/mcp>
- Hermes Agent CLI: <https://hermes-agent.nousresearch.com/docs/reference/cli-commands>
- OpenAI remote MCP: <https://developers.openai.com/api/docs/guides/tools-connectors-mcp>
- Replit remote MCP: <https://docs.replit.com/platforms/mcp-server>
