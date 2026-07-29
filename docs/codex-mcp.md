# KooyaHQ MCP for Codex

KooyaHQ MCP is a local stdio process. It exposes three tools and delegates request validation, credentials, HTTPS transport, and output handling to the CLI:

- `kooyahq_status` checks the configured profile with `auth whoami`.
- `kooyahq_discover` returns the offline machine-readable command contract.
- `kooyahq_call` executes one exact discovered command.

## Setup

Install the CLI first, then let it write the Codex entry with deterministic absolute targets:

```sh
kooyahq mcp install --client codex
kooyahq mcp doctor --client codex
```

Restart Codex and open a new thread. MCP servers and skills are loaded at client startup; an already-running thread does not gain new tools after files change.

The local server speaks newline-delimited UTF-8 JSON-RPC and supports MCP protocol version `2025-06-18`. Each input message is limited to 1 MiB. The server does not use the older `Content-Length` framing.

## Authentication display

Codex can display `Auth: Unsupported` for `kooyahq`. This is expected for this local stdio integration: it does not use MCP OAuth. API calls still require the access key stored by `kooyahq configure` or the complete `KOOYAHQ_*` environment profile.

`Tools: none` is not expected. It means startup or protocol initialization failed. Run the offline doctor before troubleshooting credentials. Run the online doctor only after local checks pass:

```sh
kooyahq mcp doctor --client codex
kooyahq mcp doctor --client codex --online
```

## Troubleshooting

### `No such file or directory (os error 2)`

The Codex entry points to a command or script that no longer exists. This commonly follows an npm update that left a dangling global shim. Reinstall the package, run the MCP installer again, restart Codex, and open a new thread.

### `Tools: none` or startup incomplete

Run the offline doctor. A healthy result confirms readable absolute paths, the `2025-06-18` handshake, all three exact tool names, and the packaged skill version. If the doctor passes but the current thread still has no tools, restart Codex and create a new thread.

### Local checks pass but calls fail

Run `kooyahq mcp doctor --client codex --online`. Authentication failures require reconfiguration or key replacement. Authorization failures require the relevant KooyaHQ permission or board membership; MCP never widens the key owner's access.

### Manual inspection

```sh
codex mcp get kooyahq --json
kooyahq-mcp --version
kooyahq-mcp --help
```

The configured transport should be stdio. Its command must be an absolute Node.js executable and its first argument an absolute `dist/bin/kooyahq-mcp.js` path.
