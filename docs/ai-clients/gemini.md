# KooyaHQ MCP for Gemini CLI

Gemini CLI runs KooyaHQ as a local stdio MCP server with the current machine's KooyaHQ profile.

## Install

```sh
kooyahq mcp install --client gemini
```

The installer updates only the `kooyahq` entry in `~/.gemini/settings.json` and preserves other `mcpServers` entries.

## Verify

```sh
kooyahq mcp doctor --client gemini --online
```

Restart Gemini CLI, then use its MCP management view (for example `/mcp list`) to confirm `kooyahq_status`, `kooyahq_discover`, and `kooyahq_call` are available.

## Use safely

Start with status, discover the command, and list projects before a mutation. Use the exact returned project display name in top-level `project`, submit a `confirm: true`, `dryRun: true` request first, then repeat only after review. Read the resource back and clean up test data. MCP cannot create projects.

## Troubleshooting and recovery

If the entry is missing or old, rerun the installer; it refuses malformed configuration rather than overwriting it. If the online doctor fails, repair the local profile using `kooyahq configure`. Do not add environment secrets to `settings.json`.
