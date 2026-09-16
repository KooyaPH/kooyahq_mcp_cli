# KooyaHQ CLI

Authenticated command-line access to KooyaHQ projects, boards, tickets, time tracking, analytics, users, notifications, events, announcements, presence locations, settings, documentation, KooyaPedia, posts, chat, and meet. The source is public for controlled internal distribution; KooyaHQ access still requires an authorized account and CLI key. The default backend origin is `https://hq-be.kooyaai.com`; API requests use `/api/cli/v1`.

The package is not published to npmjs.com, and Node.js 18 or newer is required. Install the tagged GitHub release; backend authorization remains mandatory.

## Install

Prerequisites:

- Node.js 18 or newer and npm
- Git and SSH
- Network access to GitHub

Confirm repository access:

```sh
git ls-remote https://github.com/KooyaPH/kooyahq_mcp_cli.git
```

## Linux

```sh
npm install -g --install-links=true --ignore-scripts git+https://github.com/KooyaPH/kooyahq_mcp_cli.git#v0.2.0
hash -r
kooyahq --version
kooyahq --help
kooyahq-mcp --version
```

## macOS

Install Node.js 18 or newer from nodejs.org or your approved package manager, then run:

```sh
npm install -g --install-links=true --ignore-scripts git+https://github.com/KooyaPH/kooyahq_mcp_cli.git#v0.2.0
hash -r
kooyahq --version
kooyahq --help
kooyahq-mcp --version
```

## Windows

Install Node.js 18 or newer and Git for Windows, then run this in PowerShell:

```powershell
git ls-remote https://github.com/KooyaPH/kooyahq_mcp_cli.git
npm install -g --install-links=true --ignore-scripts git+https://github.com/KooyaPH/kooyahq_mcp_cli.git#v0.2.0
kooyahq --version
kooyahq --help
kooyahq-mcp --version
```

The committed `dist/` directory is installed directly. TypeScript is not compiled on the target machine. `--install-links=true` prevents npm from leaving a link to its temporary Git checkout; `--ignore-scripts` avoids npm Git-dependency lifecycle recursion during an upgrade.

## Update

For a Git-based global upgrade, remove the current package before installing the new revision. This avoids npm's unreliable in-place replacement of a Git dependency:

```sh
npm uninstall -g kooyahq-cli
npm install -g --install-links=true --ignore-scripts git+https://github.com/KooyaPH/kooyahq_mcp_cli.git#v0.2.0
hash -r
kooyahq --version
```

## Remove

```sh
codex mcp remove kooyahq
npm uninstall -g kooyahq-cli
```

Also remove the installed kooyahq-cli skill directory: `${CODEX_HOME}/skills/kooyahq-cli` when `CODEX_HOME` is set, otherwise `~/.codex/skills/kooyahq-cli`. This leaves the separate `kooyahq-workflow` skill unchanged.

## Configure

Create an access key from the signed-in user's KooyaHQ profile. Each user can own at most one active CLI key, sees the secret only when it is created, and can revoke or replace only their own key.

Run the interactive configuration:

```sh
kooyahq configure
kooyahq auth whoami --output json
```

Configuration validates the key against the backend before saving. The secret is entered through a hidden prompt and is never accepted as a command-line flag. Useful configuration commands:

```sh
kooyahq configure show
kooyahq configure clear
```

`configure show` always redacts the secret. Failed validation does not overwrite an existing configuration.

Configuration locations and protections:

- Linux/macOS: `~/.kooyahq/config.json`, directory mode `0700`, file mode `0600`
- Windows: `%USERPROFILE%\.kooyahq\config.json`, private ACL for the current account and `SYSTEM`
- Writes use a same-directory temporary file and atomic rename. On Windows the directory and empty temporary file are protected before the secret is written; an existing config is restored if final ACL hardening fails.

For non-interactive jobs, set all three variables together. A blank or partial set fails before any request is sent:

```sh
export KOOYAHQ_BASE_URL=https://hq-be.kooyaai.com
export KOOYAHQ_ACCESS_KEY_ID=your-access-key-id
export KOOYAHQ_SECRET_ACCESS_KEY=your-secret-access-key
kooyahq auth whoami --output json
```

The base URL must be an HTTPS origin without a path, query, fragment, or embedded credentials. Plain HTTP is allowed only for localhost development.

## Install MCP in Codex

After `kooyahq configure` and `kooyahq auth whoami --output json` succeed, run the same commands on Linux, macOS, or Windows:

```sh
kooyahq mcp install --client codex
kooyahq mcp doctor --client codex
kooyahq mcp doctor --client codex --online
```

Restart Codex and open a new thread. The installer writes absolute local targets, registers the MCP server, and installs the `kooyahq-cli` skill; an already-running Codex thread will not reload either automatically.

## AI client tutorials

The local MCP server runs only on the same computer as the client. This is the supported matrix:

| Client | Setup | Verification |
| --- | --- | --- |
| Codex | `kooyahq mcp install --client codex` | `kooyahq mcp doctor --client codex --online` |
| Cursor desktop or Cursor Agent | `kooyahq mcp install --client cursor` on that client's OS | `kooyahq mcp doctor --client cursor --online`; Cursor Agent also supports `cursor-agent mcp list` |
| Claude Code | `kooyahq mcp install --client claude` | `claude mcp get kooyahq` (the CLI doctor fails closed because this query is text-only) |
| Gemini CLI | `kooyahq mcp install --client gemini` | `kooyahq mcp doctor --client gemini --online` |
| Google Antigravity | `kooyahq mcp install --client antigravity` | `kooyahq mcp doctor --client antigravity --online` |
| OpenClaw | `kooyahq mcp manual --client openclaw` | `openclaw mcp doctor kooyahq --probe` after reviewed manual registration |
| Hermes Agent | `kooyahq mcp manual --client hermes` | `hermes mcp test kooyahq` after reviewed manual registration |

The complete Linux, macOS, and Windows tutorial, configuration locations, recovery steps, and a safe read/mutation scenario are in [AI client tutorials](docs/ai-clients/index.md).

ChatGPT and Replit are browser/hosted products: **remote gateway required**. They cannot start the local stdio process and are not installed by this CLI. The same boundary applies to Gemini web/API and Claude.ai connectors. A production remote gateway must provide HTTPS, per-user authentication, backend-enforced project validation, approvals, audit logs, rate limits, health checks, and credential revocation before any web installation is documented.

## Offline help and agent discovery

Help and skill discovery run before configuration and never send network traffic:

```sh
kooyahq --help
kooyahq configure --help
kooyahq tickets --help
kooyahq tickets create --help

kooyahq --skill
kooyahq --skill configure
kooyahq --skill tickets
kooyahq --skill tickets create
kooyahq --skill tickets create --output json
```

Command help includes the workflow, exact flags, enum values, required and at-least-one groups, mutually exclusive options, conditional parameters, scalar and collection limits, cross-field ordering rules, compatibility aliases, shell-safe examples, response notes, and security behavior. `--skill ... --output json` emits schema version 2: a stable, machine-readable command contract with those constraints, import schemas, and response metadata for automation and AI tools. Configuration discovery is also offline; it never reveals stored credentials.

Prefer explicit selectors such as `--board-id`, `--board-key`, `--ticket-id`, and `--ticket-key`. Mongo-backed selectors require a 24-character lowercase hexadecimal ObjectId; keys use the documented `OPS` or `OPS-42` forms. Legacy positional IDs remain deprecated compatibility aliases until the next major version.

## Local stdio MCP server for AI tools

The package also installs `kooyahq-mcp`, a local stdio MCP server for AI clients. It is not a hosted remote service. It runs on the user's machine, uses the same `kooyahq configure` profile or `KOOYAHQ_*` environment variables, and sends requests only through the same authenticated backend routes as the human CLI. It uses newline-delimited UTF-8 JSON-RPC, supports MCP protocol `2025-06-18`, and bounds each input message at 1 MiB.

For Codex, use the deterministic installer and doctor instead of a bare command name:

```sh
kooyahq mcp install --client codex
kooyahq mcp doctor --client codex
kooyahq mcp doctor --client codex --online
```

The installer registers absolute Node.js and server-script paths and installs the packaged `kooyahq-cli` skill without changing an existing `kooyahq-workflow` skill. Restart Codex and open a new thread after installation so it reloads the MCP server and skills. The default doctor is offline; `--online` additionally checks the authenticated KooyaHQ profile without printing credentials.

Do not copy a generic MCP entry that invokes the bare `kooyahq-mcp` command: shell lookup and npm shims can become stale. Use `kooyahq mcp install --client <client>` for supported automatic clients; it writes the exact absolute Node.js and server-script descriptor. For manual-only clients, run `kooyahq mcp manual --client <client>` and enter the emitted absolute descriptor after reviewing it.

Smoke-test the binary without starting a long-running session:

```sh
kooyahq-mcp --version
kooyahq-mcp --help
```

MCP exposes three stable tools:

- `kooyahq_status`: verifies the configured access key and returns the acting user profile.
- `kooyahq_discover`: returns the same schema version 2 command contract as `kooyahq --skill ... --output json`, including parameters, enums, workflows, relationships, examples, and safety notes.
- `kooyahq_call`: executes one exact command using structured arguments keyed by CLI flag name without leading dashes.

Example discovery request:

```json
{
  "scope": "tickets create"
}
```

Example read request:

```json
{
  "command": "tickets list",
  "args": {
    "board-key": "OPS",
    "search": "release",
    "sort": "createdAt",
    "order": "desc",
    "limit": 20
  }
}
```

Example mutation dry-run:

```json
{
  "command": "tickets create",
  "project": "Exact project display name from projects list",
  "confirm": true,
  "dryRun": true,
  "args": {
    "board-key": "OPS",
    "ticket-type": "task",
    "title": "Release"
  }
}
```

MCP safety behavior:

- Every non-GET command requires top-level `project` with an exact display name returned by `projects list`, plus `confirm: true`, before the bridge can create a network request. `projects create` is deliberately unavailable through MCP.
- `dryRun: true` validates and returns the request shape without reading credentials or sending network traffic, while still requiring the project declaration.
- Unknown commands and unknown argument keys are rejected locally.
- Import commands do not read local files through MCP. Pass bounded structured JSON using `args.input`; the bridge supplies it to the existing import validator as standard input.
- `all: true` maps to `--all` and keeps the same 100-page, 100,000-item, and 50 MiB aggregate limits.
- MCP requests are audited by the backend as `clientType: "mcp"` through the `kooyahq-mcp/<version>` user-agent.
- Backend permissions remain authoritative. The MCP server cannot widen access beyond the configured key owner.
- `events watch` is rejected over MCP (long-lived SSE). MCP hosts must use `events poll` / `events cursor`, or run `kooyahq events watch` as a separate CLI process.

## Company-internal project gate

For work-related mutations, first run `kooyahq projects list --all --output json` and map the work to one exact project display name returned by the live catalog. Do not infer a project from a repository path, board name, ticket title, or a near match.

If no exact project matches, do not create, update, move, comment on, or time-track anything. Report the missing project and wait for an authorized owner to add or select it. Do not create a project solely to bypass this gate; after an explicitly authorized project creation, list projects again and use the returned display name.

## Command catalog

The catalog below is the supported frontend-parity surface. Run any command with `--help` for its exact parameters.

### Authentication and projects

```text
auth whoami

projects list
projects get
projects create
projects update
projects delete
projects keyword-migration preview
projects keyword-migration apply
```

Keyword migration reassigns time entries using the same keyword workflow as Project Management. Preview first; apply requires confirmation unless `--yes` is supplied.

Project names are limited to 100 characters, emoji to 32 characters, and icon URLs to 2,048 characters. Use `projects update --clear-emoji --clear-icon-url` to intentionally remove optional presentation values.

### Boards

```text
boards list
boards get
boards create
boards update
boards delete
boards favorite
boards favorite set
boards favorite toggle
boards activities list
boards mentions list
boards assignees list

boards members list
boards members add
boards members update-role
boards members remove

boards columns list
boards columns add
boards columns update
boards columns move
boards columns remove

boards settings get
boards settings update
boards settings fields list
boards settings fields set
boards settings fields reset

boards automation list
boards automation add
boards automation update
boards automation remove
```

Boards can be selected by exact ID or key. Activities, mention candidates, and assignee candidates are paginated and support search and allowlisted sorting. Member, column, settings, favorite, and GitHub automation mutations require the same board access as the web application. Column moves use semantic `before`, `after`, `first`, or `last` placement. Removing an occupied column requires an explicit destination and is refused if the backend cannot guarantee an atomic migration.

Use explicit clear flags for nullable or resettable board values: `boards settings update --clear-description`, `boards columns update --clear-color --clear-wip-limit`, and `boards automation update --clear-target-branch --clear-description`. Field updates require at least one of `--visible` or `--order`. Creating an automation rule requires `--enabled`, `--status`, and `--column-id` so an automation client cannot depend on hidden frontend defaults.

`boards get` includes the current favorite state. `boards favorite` is the compatibility alias for `boards favorite toggle`; the backend records the canonical toggle command in CLI access audits.

### Tickets, comments, and board work

```text
tickets list
tickets search
tickets assigned
tickets get
tickets detail
tickets create
tickets update
tickets delete
tickets move
tickets archive
tickets unarchive
tickets improve
tickets improve-draft
tickets import preview
tickets import apply
tickets activities list
tickets viewers list

tickets comments list
tickets comments create
tickets comments update
tickets comments delete

tickets parent set
tickets parent clear
tickets epic set
tickets epic clear
tickets subtasks list

tickets criteria list
tickets criteria add
tickets criteria set
tickets criteria remove

tickets documents list
tickets documents add
tickets documents remove

tickets relations list
tickets relations add
tickets relations remove
tickets blockers list
tickets blockers add
tickets blockers remove

tickets development get
tickets development set
tickets development clear
```

Ticket IDs and keys are exact selectors. Board-scoped list/create/import commands require exactly one board ID or board key. Ticket mutations cover the web application's lifecycle, comments, assignments, relationships, blockers, hierarchy, acceptance criteria, documents, and GitHub development data. Paginated comment, assigned-ticket, activity, viewer, and subtask reads support `--search` in addition to their documented filters and sorting.

Ticket creation accepts mutually exclusive `--parent-ticket-id|--parent-ticket-key` and `--root-epic-id|--root-epic-key` selectors. A subtask requires exactly one of `--parent-ticket-id|--parent-ticket-key`; other ticket types may omit a parent. Move anchors accept exact ID or key variants for `before` and `after`, plus `--first` or `--last`.

Descriptions and structured comment content use the canonical rich-text object `{"type":"html","content":"<p>Ready to ship</p>"}`. The CLI validates that exact shape, rejects extra properties, and limits content to 100,000 characters before any request is sent. Plain `--content` remains available for comment text.

`tickets improve` and `tickets improve-draft` return preview suggestions only and never apply fields automatically. Draft improvement requires `--title` and accepts flattened `--description-json`, `--acceptance-criteria-json`, `--ticket-type`, and `--user-command` fields. User guidance is limited to 2,000 characters. Development updates accept `--branch`, which is sent using the backend `branchName` contract.

Document links do not have persistent document IDs. Add a document with exact `--name`, `--url`, and `--type`; remove it by the same exact `--url`. Blocker reads accept `--direction blocked-by|blocking|all` (default `all`) and return a `{ blockedBy, blocking }` relationship envelope.

Ticket imports accept JSON or CSV from a file or standard input, never both:

```sh
kooyahq tickets import preview --board-key OPS --file tickets.csv
kooyahq tickets import apply --board-key OPS --operation-id 123e4567-e89b-42d3-a456-426614174000 --stdin --format json
```

Apply requires a canonical lowercase UUID in `--operation-id`. If the result is lost, retry the exact same import with the same operation ID; the backend returns the original result without duplicating writes. Reusing an operation ID with different normalized rows or board scope returns a conflict. Preview does not require an operation ID.

Input must be UTF-8 and is limited to 5 MiB and 250 tickets. JSON input is an array of row objects. Supported row fields are `importRef`, `title`, `ticketType`, `status`, `priority`, `reporterEmail`, `assigneeEmail`, `points`, `tags`, `parentRef`, `rootEpicRef`, `startDate`, `endDate`, `dueDate`, `description`, `acceptanceCriteria`, `documents`, `comments`, `relatedRefs`, and `github`.

CSV headers are strictly allowlisted: `importRef`, `title`, `ticketType`, `status`, `priority`, `reporterEmail`, `assigneeEmail`, `points`, `tags`, `parentRef`, `rootEpicRef`, `startDate`, `endDate`, `dueDate`, `description`, `acceptanceCriteriaJson`, `documentsJson`, `commentsJson`, `relatedRefs`, `githubBranchName`, `githubTargetBranch`, `githubPullRequestUrl`, and `githubStatus`. Quoted CSV fields and flattened JSON fields are normalized locally. The CLI sends normalized rows under the backend's `rows` contract.

### Time tracking

```text
time timers list
time timers start
time timers start-many
time timers pause
time timers resume
time timers stop
time timers stop-all
time timers add-task

time entries list
time entries today
time entries get
time entries create
time entries update
time entries delete

time workday status
time workday summary
time workday end
```

Timer mutations always act on the authenticated key owner. A timer ID is optional for pause, resume, and stop only when exactly one eligible timer exists; the CLI never guesses among multiple timers. Timer project options require project display names: `--project`, `--projects`, and time-entry project options must name projects from `projects list`. Matching is case-insensitive and the backend stores the catalog display name. Project IDs are rejected by the server, as are blank or unknown names. `start-many` accepts at most 20 case-insensitively unique projects, with each project limited to 100 characters, and is all-or-nothing: the backend either starts the complete eligible batch or starts none. Timer and entry task text is limited to 1,000 characters; explicit durations are limited to 1,000,000 seconds. Timer, entry, and today's-entry lists support `--search`.

Team entry reads require `--scope team`, and `--user-id` is rejected without that explicit scope. Entry list dates use strict `YYYY-MM-DD` values and span at most 366 inclusive calendar dates. Entry timestamps must be zoned ISO 8601 values and are checked for ordering when both are present. The backend still checks the user's time-entry permission.

### Analytics and budgets

```text
analytics time
analytics team
analytics projects
analytics costs
analytics costs live
analytics costs projects list
analytics costs projects get
analytics costs forecast
analytics costs compare
analytics costs budgets list
analytics costs budgets create
analytics costs budgets update
analytics costs budgets delete
analytics costs budgets comparisons
```

Time, team, and project summaries require exact `YYYY-MM-DD` start and end dates and span at most 366 inclusive calendar dates. `analytics time` also accepts an optional exact `--user-id` for authorized user-level analysis. Cost summary dates are optional, but supplying either boundary requires both; supplied ranges use the same 366-day maximum. Cost project, budget, and budget-comparison lists support `--search`.

Budget start dates must be strictly earlier than end dates. Currency values are exactly three ASCII letters, and alert thresholds are percentages from 0 through 100 with `warning` no greater than `critical`. Use `analytics costs budgets update --clear-project` to remove a budget's project scope. Current cost analytics and budget routes require the backend `system:fullAccess` permission because per-person cost and time pairs can reveal compensation rates. The CLI never widens that authorization boundary.

### Users and administrator views

```text
users list
users get
users create
users update
users delete
users clients create
users stats
users activity list
users export
users permissions get
users permissions update
users templates list
users templates get
```

`users list --all --output json` is the assignment-friendly user lookup. It supports `--search`, `--include-disabled`, `--position`, `--status`, `--created-from`, and `--created-to`; `--status` filters the stored profile status (`online|busy|away|offline`), not transient socket presence. Created-date boundaries may be used independently, or together for an ordered range of at most 366 inclusive calendar dates.

Management, client creation, salary fields, activity logs, exports, permission changes, and templates remain permission-gated by the backend. Activity actions are allowlisted and shown by `kooyahq users activity list --help`; search can match an actor name or email. Discover the current assignable permission templates with `kooyahq users templates list --output json`; the CLI rejects unknown or duplicate permission names locally, while the backend still decides which catalog entries the acting user may assign. Preview permission changes with `--dry-run`. Use `users export --format csv --output raw` for a CSV stream. User create/update supports `--whatsapp-phone`; update supports `--clear-whatsapp-phone`, `--clear-position`, `--clear-birthday`, and `--clear-bio`. Use `--clear-permissions` to intentionally send an empty permission array instead of passing an ambiguous blank CSV value.

### Notifications

```text
notifications list
notifications count
notifications mark-read
notifications mark-all-read
```

Notifications are always scoped to the authenticated user. Lists are paginated and support `--unread-only true|false`.

### Events

```text
events watch
events poll
events cursor
```

Permission-gated live HQ signals for the access-key owner (notifications, chat, tickets). Requires `cli:access` plus each channel’s read permission; unauthorized channels are omitted from the response. If the key has no permitted channels, the API returns 403.

MCP loop (preferred for hosts):

```sh
kooyahq events cursor --output json
kooyahq events poll --since CURSOR --output ndjson
# repeat poll with the latest returned cursor
```

- `events cursor` — bootstrap the latest cursor.
- `events poll --since CURSOR` — one-shot buffer read for MCP / `kooyahq_call` loops (`--output ndjson` prints one event object per line). Optional with `--channels notifications,chat,tickets` (comma-separated) to subscribe only to allowed channels you need.
- `events watch` — long-lived SSE side process (CLI only); writes one JSON object per line (`cursor`, `channel`, `event`, `data`, `at`). Same `--channels` flag. MCP hosts must not call `events watch`; use `events poll` / `events cursor` over MCP instead, or run `kooyahq events watch` as a separate CLI process.

Default channels when `--channels` is omitted: all channels the key is permitted to subscribe to.

### Announcements

```text
announcements list
announcements get
announcements create
announcements update
announcements delete
```

### Presence

```text
presence locations list
```

Location snapshot only. Live presence sockets and updates are not available over CLI/MCP.

### Settings and personalization

```text
settings theme get
settings theme set
settings theme mandatory set
settings preferences get
settings preferences set
settings profile get
settings profile update
```

Theme routes use `/settings/theme`. Preferences and profile use `/users/preferences` and `/users/profile`. Profile updates accept optional `--profile-pic` and `--banner` file paths as multipart uploads.

### Documentation

```text
documentation list
documentation create-link
documentation create-file
documentation update
documentation delete
documentation pin
documentation unpin
```

`documentation create-file` requires `--file <path>` as a multipart upload.

### KooyaPedia

```text
kooyapedia home
kooyapedia search
kooyapedia suggest
kooyapedia pages list
kooyapedia pages get
```

### Posts / KooyaFeed

```text
posts list
posts list-mine
posts create
posts update
posts delete
posts poll vote
posts comments list
posts comments create
posts comments update
posts comments delete
posts reactions list
posts reactions add
posts reactions remove
```

Create and update accept optional `--image` file paths. Delete is available on CLI/MCP and on the web API.

### Chat

```text
chat conversations list
chat conversations get
chat conversations create-direct
chat conversations create-group
chat conversations update
chat conversations members add
chat conversations members remove
chat conversations leave
chat messages list
chat messages send
chat messages update
chat messages delete
chat conversations read
chat conversations unread
chat contacts list
chat conversations archive
chat conversations unarchive
chat conversations delete
```

Chat commands remain HTTP request/response (list, send, unread, and so on). There is no dedicated `chat watch`. For live chat, ticket, and notification signals, use `events watch` (CLI process) or `events poll` / `events cursor` (MCP).

### Meet

```text
meet contacts list
meet token create
meet recordings list
meet recordings get
meet recordings analysis
meet recordings upload
meet egress start
meet egress stop
meet egress status
meet egress active
```

`meet recordings upload` requires `--file <path>` for the recording multipart field.

## Common flags and scripting

Paginated list commands support:

```text
--page <1-100>
--limit <1-100>
--sort <allowlisted-field>
--order <asc|desc>
--all
```

Global command behavior:

- `--output table` is the human-readable default.
- `--output json` preserves structured API responses.
- `--output raw` is intended for text exports.
- `--dry-run` validates and prints the request without reading credentials or sending traffic.
- `--all` fetches paginated GET results sequentially with hard aggregate caps of 100 pages, 100,000 items, and 50 MiB of retained JSON data.
- `--page` and `--all` cannot be combined; omit `--page` when requesting every page.
- `--yes` skips a documented confirmation; it is rejected on commands that do not support it.
- Mutations are never retried. GET transport failures are retried at most twice after the first attempt.

Examples:

```sh
kooyahq boards get --board-key OPS --output json
kooyahq boards activities list --board-key OPS --search "status" --sort createdAt --order desc --all --output json
kooyahq boards members add --board-key OPS --user-id 507f1f77bcf86cd799439011 --role member --dry-run
kooyahq boards columns update --board-key OPS --column-id done --clear-color --clear-wip-limit --dry-run
kooyahq tickets list --board-key OPS --assignee-id 507f1f77bcf86cd799439011 --sort createdAt --order desc --all --output json
kooyahq tickets create --board-key OPS --ticket-type task --title "Release" --assignee-id 507f1f77bcf86cd799439011 --dry-run
kooyahq tickets create --board-key OPS --ticket-type subtask --title "Release test" --parent-ticket-key OPS-42 --root-epic-key OPS-1 --dry-run
kooyahq tickets improve --ticket-key OPS-42 --user-command "Focus on rollback safety" --output json
kooyahq tickets documents add --ticket-key OPS-42 --name "Release plan" --type doc --url https://example.com/release-plan
kooyahq tickets documents remove --ticket-key OPS-42 --url https://example.com/release-plan
kooyahq tickets blockers list --ticket-key OPS-42 --direction blocked-by --output json
kooyahq tickets blockers add --ticket-key OPS-42 --blocker-ticket-key OPS-12
kooyahq time timers start --project "Project Alpha" --task "Release review"
kooyahq time timers start-many --projects "Project Alpha,Project Beta" --task "Review"
kooyahq time entries list --scope team --user-id 507f1f77bcf86cd799439011 --start-date 2026-07-01 --end-date 2026-07-25 --output json
kooyahq analytics time --user-id 507f1f77bcf86cd799439011 --start-date 2026-07-01 --end-date 2026-07-25 --output json
kooyahq analytics team --start-date 2026-07-01 --end-date 2026-07-25 --output json
kooyahq analytics costs --output json
kooyahq notifications list --unread-only true --all --output json
kooyahq users list --search "Alex" --all --output json
kooyahq users update --user-id 507f1f77bcf86cd799439011 --clear-position --clear-birthday --clear-bio --clear-whatsapp-phone --clear-permissions --dry-run
```

## Authorization, auditing, and security

The CLI is a typed wrapper around HTTPS requests; it is not a permission bypass. Every request is authenticated by the backend and evaluated as the access-key owner. Board membership, board roles, time-entry scopes, user-management permissions, analytics permissions, and administrator permissions remain authoritative server-side.

Accepted CLI requests are audited in KooyaHQ with the acting user, access-key ID, canonical command/action, source IP, reported CLI version/platform, and timestamp. Audit records do not store the request body, response body, or secret. CLI access audits use the dedicated administrator-log permission and a 180-day rolling retention window.

Client security behavior:

- No request is sent for blank or partial configuration.
- Credentials are sent only to the validated origin with `Authorization: KooyaKey <id>:<secret>`.
- Redirects are rejected so credentials cannot cross origins.
- Requests time out after 30 seconds and response bodies are limited to 10 MiB.
- The default Node transport supports HTTP only for localhost development and forces IPv4 for HTTPS backend requests.
- Malformed JSON responses fail as protocol errors instead of being treated as empty success responses.
- Secrets are never printed by `configure show`, help, skills, or dry-run output.
- Reflected credentials are redacted from API error messages.
- Configuration uses private filesystem permissions and atomic writes.
- Human-readable tables remove terminal control characters; JSON and raw output remain structurally unmodified for scripting.
- Do not put secrets in shell history, tickets, chat, screenshots, repositories, or command flags.

Revoke a compromised key in the user's KooyaHQ profile, remove it from CI/environment storage, and run `kooyahq configure clear`. Clearing the local file alone does not revoke the server-side key.

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success or user-cancelled confirmation |
| `1` | Network or server failure |
| `2` | Configuration or local validation failure |
| `3` | Authentication failure (`401`) |
| `4` | Authorization failure (`403`) |
| `5` | Not found or conflict (`404`/`409`) |

## Troubleshooting

- `kooyahq: command not found` after a successful Linux/macOS install: run `hash -r`, then `kooyahq --version`.
- Codex reports `No such file or directory (os error 2)`: reinstall the package, run `kooyahq mcp install --client codex`, then restart Codex and open a new thread. The prior entry or global npm shim is stale or dangling.
- Codex reports `Tools: none` or startup incomplete: run `kooyahq mcp doctor --client codex`. `Auth: Unsupported` by itself is expected for this local stdio server because KooyaHQ uses its saved API credential profile rather than MCP OAuth.
- `tsc: not found` during installation: fetch the current `main` and reinstall. Supported GitHub installs use committed `dist/` files and do not compile TypeScript.
- SSH or repository error: verify `git ls-remote https://github.com/KooyaPH/kooyahq_mcp_cli.git` (or SSH equivalent `git@github.com:KooyaPH/kooyahq_mcp_cli.git`).
- `KooyaHQ is not configured`: run `kooyahq configure` or provide all three environment variables.
- Exit `3`: the key is invalid, revoked, expired, or copied incorrectly.
- Exit `4`: the acting user lacks the required backend permission or resource membership.
- Timer ambiguity: run `kooyahq time timers list --output json`, then pass `--timer-id` explicitly.
- TLS/network failure: verify the configured origin and corporate proxy/firewall. Redirects are intentionally rejected.

## Development and CI

```sh
npm ci
npm test
npm run typecheck
npm run build
node scripts/verify-dist.mjs
npm audit --omit=dev
```

Required CI verifies Node.js 18, 20, 22, and 24 on Linux, checks that committed `dist/` matches the TypeScript source, packs and installs the artifact, and performs a local Git global installation into an isolated prefix. Hosted Ubuntu, macOS, and Windows smoke jobs are defined in the workflow and run when the repository variable `KOOYAHQ_CLI_ENABLE_HOSTED_SMOKE` is set to `true`; keep them optional when the GitHub organization has no hosted-runner capacity. The repository has no npm publication or deployment workflow.
