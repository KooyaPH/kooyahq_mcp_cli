# KooyaHQ MCP for Google Antigravity

Google Antigravity uses the local stdio KooyaHQ server on the same workstation. It is separate from Gemini web or API integrations.

## Install

```sh
kooyahq mcp install --client antigravity
```

The installer adds only the KooyaHQ entry to `~/.gemini/config/mcp_config.json`, preserving unrelated MCP servers.

## Verify

```sh
kooyahq mcp doctor --client antigravity --online
```

Reload MCP servers from the Antigravity MCP manager and confirm the three KooyaHQ tools appear.

## Use safely

Call status, discover the exact command, and list projects before any mutation. The top-level `project` must exactly match the live project display name. Use `confirm: true` plus `dryRun: true` first, then remove `dryRun` only after review, read the result, and clean up. MCP project creation remains blocked.

## Troubleshooting and recovery

Rerun the installer for a missing or stale entry; invalid JSON is rejected without a write. An online failure means reconfigure the local KooyaHQ profile rather than copying secrets into Antigravity configuration.
