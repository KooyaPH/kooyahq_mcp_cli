---
name: kooyahq-cli
description: Use the local KooyaHQ CLI and MCP tools safely for projects, boards, tickets, timers, users, analytics, and notifications.
---

# KooyaHQ CLI

Use this skill when the user asks to inspect or change KooyaHQ through `kooyahq` or the three local MCP tools.

## Company-internal project gate

This is a mandatory gate for every KooyaHQ mutation associated with work. Before any KooyaHQ mutation, run `kooyahq projects list --all --output json` and map the work to one exact returned project display name. Do not infer a project from a repository path, board name, ticket title, or a similar-looking name.

If no exact project display name matches the work, do not create, update, move, comment on, or time-track anything. State that the project is not in the live KooyaHQ catalog and ask an authorized owner to add or select it. Do not create a project merely to bypass this gate; create one only when an authorized user explicitly requests that project creation, then list projects again and use the returned display name.

## Start with discovery

Call `kooyahq_discover` before relying on a remembered command contract. Use a narrow scope such as `boards`, `tickets move`, or `time timers start`. The equivalent offline CLI contract is:

```sh
kooyahq --skill boards --output json
kooyahq --skill tickets move --output json
```

Use the exact command name and argument keys returned by discovery. Prefer exact selectors such as `board-id`, `board-key`, `ticket-id`, and `ticket-key`; never guess an ID or silently substitute a fuzzy name.

## Reads and mutations

Use `kooyahq_call` with the exact discovered command. Reads do not need confirmation. Every MCP mutation must provide a top-level `project` field equal to an exact live project display name returned by `kooyahq projects list --all --output json`. MCP `projects create` is rejected; an authorized owner must create the project through an approved non-MCP workflow before it can be used here. For every allowed mutation:

1. Call it first with top-level `project`, `dryRun: true`, and `confirm: true`.
2. Inspect the returned method, path, query, and body with the user when the change is consequential.
3. Execute with the same top-level `project` and `confirm: true` only after the intended target is exact.
4. Read the affected resource again and verify the result.
5. Clean up temporary boards, tickets, timers, or test data created for verification.

`confirm: true` is an MCP bridge safety gate. Backend authorization and resource membership still apply.

## Live events

For live HQ signals (notifications, chat, tickets), MCP hosts must use `events cursor` then `events poll` via `kooyahq_call`. Do not call `events watch` over MCP; it is rejected. Run `kooyahq events watch` only as a separate CLI side process when a long-lived NDJSON stream is needed.

## Boards and tickets

After the company-internal project gate passes, discover the board first, keep its exact ID or key, then discover the ticket command. For moves and reorders, use the semantic placement returned by discovery: `before`, `after`, `first`, or `last`. Read the ticket and destination board before moving, then read them again afterward. Do not edit MongoDB or another datastore directly; all changes must pass through the KooyaHQ CLI API.

## Timers

List projects and active timers before starting or changing work:

```sh
kooyahq projects list --all --output json
kooyahq time timers list --output json
```

Timer project arguments require an exact project display name from `projects list`, not a project ID. Preserve the spelling returned by the catalog. Supply an explicit timer ID when more than one timer is eligible; do not invent an end-shift command.

## Codex MCP status

KooyaHQ is a local stdio server and uses the credential profile saved by `kooyahq configure`. Codex may show `Auth: Unsupported`; that is expected because MCP-level OAuth is not used. It does not mean KooyaHQ API authentication is disabled.

`Tools: none`, `No such file or directory`, or an incomplete startup warning is a real startup/configuration failure. Run:

```sh
kooyahq mcp doctor --client codex
kooyahq mcp install --client codex
```

Then restart Codex and open a new thread. Use `--online` with doctor only when an authenticated `whoami` network check is wanted.
