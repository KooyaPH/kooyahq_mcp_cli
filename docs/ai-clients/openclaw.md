# KooyaHQ MCP for OpenClaw

OpenClaw manages the local KooyaHQ stdio registration through its MCP registry. Its current CLI does not expose a stable descriptor query that this installer can use to prove an existing entry is safe to replace, so registration is deliberately manual.

## Install

```sh
kooyahq mcp manual --client openclaw
```

The command prints the absolute Node.js executable and KooyaHQ MCP script for this operating system without invoking OpenClaw or modifying its configuration. Copy those values into the documented registry command:

```sh
openclaw mcp add kooyahq --command "<node-executable>" --arg "<kooyahq-mcp-script>"
```

Do not replace an existing `kooyahq` entry unless its current descriptor has been reviewed and explicitly approved. The KooyaHQ profile is not passed to OpenClaw.

## Verify

```sh
openclaw mcp doctor kooyahq --probe
```

Reload the OpenClaw runtime after the probe passes. The KooyaHQ CLI cannot attest to OpenClaw's persisted descriptor, so there is no green `kooyahq mcp doctor --client openclaw` command.

## Use safely

Read status, discover the operation, list exact projects, and read the target. Mutations require top-level `project` from that list, `confirm: true`, and a first `dryRun: true` call. Review, execute, read back, and clean up temporary items. MCP project creation is intentionally unavailable.

## Troubleshooting and recovery

If the registry check fails, print fresh values with `kooyahq mcp manual --client openclaw`, compare them to the existing entry, and correct the entry through OpenClaw's own workflow. Credentials stay only in the local KooyaHQ profile. Run `kooyahq configure` when `kooyahq auth whoami --output json` fails.
