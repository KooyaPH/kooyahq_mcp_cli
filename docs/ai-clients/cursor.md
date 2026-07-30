# KooyaHQ MCP for Cursor

Install the KooyaHQ CLI and configure its local profile on the same operating system as the target Cursor client. Cursor desktop and Cursor Agent use the same local stdio registration only when they share that OS home directory; WSL and Windows registrations are separate.

## Install

```sh
kooyahq mcp install --client cursor
```

The installer writes the absolute Node.js executable and KooyaHQ MCP script to `~/.cursor/mcp.json`, preserves other MCP servers, and never copies credentials into that file. Restart Cursor desktop after the command succeeds.

## Verify

```sh
kooyahq mcp doctor --client cursor --online
cursor-agent mcp list
cursor-agent mcp list-tools kooyahq
```

The expected tools are `kooyahq_status`, `kooyahq_discover`, and `kooyahq_call`. The online check verifies the profile without printing its secret.

## Use safely

Start with `kooyahq_status`, discover the exact operation, and read the target. For any mutation, first call `projects list --all`, then supply its exact project display name as top-level `project`, `confirm: true`, and `dryRun: true`. Repeat only after review without `dryRun`, read the result, and clean up temporary data. MCP project creation is intentionally unavailable.

## Troubleshooting and recovery

If Cursor has no tools, restart the desktop app and use `cursor-agent mcp list`. If the doctor reports an absent or stale entry, rerun the installer. If its online check fails, run `kooyahq configure` and verify `kooyahq auth whoami --output json`; never put credentials in `mcp.json`.
