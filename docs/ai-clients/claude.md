# KooyaHQ MCP for Claude Code

The CLI registers a user-scoped local stdio server for Claude Code. It does not install a server into Claude.ai.

## Install

```sh
kooyahq mcp install --client claude
```

Restart Claude Code or start a new session after installation. Claude Desktop may use the same local stdio transport only when it is running on this computer; Claude.ai remains a hosted service.

## Verify

```sh
claude mcp get kooyahq
```

In an interactive Claude Code session, `/mcp` should show the three expected tools. `kooyahq mcp doctor --client claude` deliberately exits nonzero after reporting that Claude's text-only lookup cannot prove the exact persisted descriptor; it does not substitute a direct local handshake for that proof.

## Use safely

Call `kooyahq_status`, discover the exact operation, then read `projects list --all` and the target resource. A mutation must include an exact returned project display name as `project`, `confirm: true`, and initially `dryRun: true`. Confirm the same request only after review, read it back, and remove temporary test data. MCP project creation is intentionally rejected.

## Troubleshooting and recovery

If `claude mcp get kooyahq` is missing or stale, rerun the installer. A missing `claude` executable prevents registration and changes nothing; install Claude Code first. If the online doctor fails, repair the KooyaHQ profile with `kooyahq configure`, not by adding secrets to Claude configuration.
