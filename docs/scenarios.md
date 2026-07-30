# KooyaHQ CLI and MCP scenarios

Use discovery before every workflow whose contract is not already visible in the current session. The examples use placeholders deliberately; replace them only with exact values returned by KooyaHQ.

## Read-only discovery

CLI:

```sh
kooyahq --skill boards --output json
kooyahq boards list --all --output json
kooyahq --skill tickets list --output json
```

MCP:

1. Call `kooyahq_discover` with `{ "scope": "boards" }`.
2. Call `kooyahq_call` with `{ "command": "boards list", "all": true }`.
3. Keep the exact board ID or key returned by the read.

## Create board work and clean it up

Discover `boards create`, `tickets create`, `tickets get`, `tickets delete`, and `boards delete`. Dry-run each mutation first. Example MCP dry-run:

```json
{
  "command": "boards create",
  "project": "Exact project display name from projects list",
  "confirm": true,
  "dryRun": true,
  "args": {
    "project-id": "507f1f77bcf86cd799439011",
    "name": "API verification"
  }
}
```

After reviewing the request, repeat without `dryRun`. Create the ticket against the exact returned board selector, read it back, and verify all fields. Cleanup is part of the scenario: delete the temporary ticket, verify it is absent, delete the temporary board, and verify the board is absent. Do not leave test data behind.

## Move or reorder a ticket

1. Discover `tickets move` and read the source ticket plus destination board.
2. Select the destination by exact board ID or key.
3. Select placement using one discovered semantic option: `before`, `after`, `first`, or `last`.
4. Call a dry-run with the exact `project` display name and `confirm: true`.
5. Execute with the same `project` and `confirm: true` after checking the target and placement.
6. Read the ticket and destination ordering again. Report an API error rather than changing MongoDB directly.

## Mutations and confirmation

Every non-GET MCP command requires top-level `project` with the exact display name returned by `projects list`, plus `confirm: true`. Use `dryRun: true` on the first call; it validates locally without credentials or network traffic while still requiring the project declaration. The actual call omits `dryRun` but retains `project` and `confirm: true`; it verifies the live catalog immediately before the mutation. MCP deliberately rejects `projects create`. A dry-run is not evidence that the backend authorized or applied the change, so always verify with a read.

For the human CLI, use `--dry-run`, then execute interactively. Use `--yes` only where discovery documents that flag and the user has already approved the exact mutation.

## Timers with exact project display names

List exact project display names and active timers first:

```sh
kooyahq projects list --all --output json
kooyahq time timers list --output json
kooyahq time timers start --project "Project Alpha" --task "Release review"
```

`Project Alpha` must be replaced by an exact display name returned by `projects list`; project IDs are invalid. If multiple timers are eligible for pause, resume, or stop, pass the exact timer ID. There is no inferred end-shift command: discover and use only the documented time commands.

## Troubleshoot Codex startup

If Codex reports `No such file or directory`, `Tools: none`, or startup incomplete:

```sh
npm install -g --install-links=true --ignore-scripts git+ssh://git@github.com/KooyaPH/kooyahq_cli.git#main
hash -r
kooyahq mcp install --client codex
kooyahq mcp doctor --client codex
```

Restart Codex and open a new thread. `Auth: Unsupported` alone is expected for a local stdio server; it is different from a startup failure. Use `--online` only to add an authenticated profile check after the local doctor passes.

## Verification and cleanup checklist

- Read the target before mutation and retain its exact selector.
- Dry-run and review the normalized request.
- Execute only with explicit confirmation.
- Read the target after mutation and compare the intended fields or order.
- Stop any timer created for a test.
- Delete temporary tickets before their temporary board.
- Verify cleanup with a final read or list.
- Never bypass the API with direct database edits.
