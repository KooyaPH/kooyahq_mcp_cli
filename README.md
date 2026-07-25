# KooyaHQ CLI

Private, authenticated command-line access to KooyaHQ projects, boards, tickets, time tracking, analytics, users, and notifications. The default backend origin is `https://hq-be.kooyaai.com`; API requests use `/api/cli/v1`.

The repository is private, the package is not published to npmjs.com, and Node.js 18 or newer is required. GitHub access is required to install it.

## Install

Prerequisites:

- Node.js 18 or newer and npm
- Git and SSH
- Read access to `KooyaPH/kooyahq_cli`
- A GitHub SSH key available to the current shell

Confirm repository access:

```sh
ssh -T git@github.com
git ls-remote git@github.com:KooyaPH/kooyahq_cli.git
```

### Linux and macOS

```sh
npm install -g --install-links=true git+ssh://git@github.com/KooyaPH/kooyahq_cli.git#main
hash -r
kooyahq --version
kooyahq --help
```

### Windows

Run in PowerShell with Git for Windows and Node.js installed:

```powershell
npm install -g --install-links=true git+ssh://git@github.com/KooyaPH/kooyahq_cli.git#main
kooyahq --version
kooyahq --help
```

The committed `dist/` directory is installed directly. TypeScript is not compiled on the target machine. `--install-links=true` prevents npm from leaving a link to its temporary Git checkout. To uninstall:

```sh
npm uninstall -g kooyahq-cli
```

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
- Writes use a same-directory temporary file and atomic rename

For non-interactive jobs, set all three variables together. A blank or partial set fails before any request is sent:

```sh
export KOOYAHQ_BASE_URL=https://hq-be.kooyaai.com
export KOOYAHQ_ACCESS_KEY_ID=your-access-key-id
export KOOYAHQ_SECRET_ACCESS_KEY=your-secret-access-key
kooyahq auth whoami --output json
```

The base URL must be an HTTPS origin without a path, query, fragment, or embedded credentials. Plain HTTP is allowed only for localhost development.

## Offline help and agent discovery

Help and skill discovery run before configuration and never send network traffic:

```sh
kooyahq --help
kooyahq tickets --help
kooyahq tickets create --help

kooyahq --skill
kooyahq --skill tickets
kooyahq --skill tickets create
kooyahq --skill tickets create --output json
```

Command help includes the workflow, exact flags, enum values, required groups, conditional parameters, compatibility aliases, examples, and security behavior. `--skill ... --output json` is a stable, machine-readable command contract intended for automation and AI tools.

Prefer explicit selectors such as `--board-id`, `--board-key`, `--ticket-id`, and `--ticket-key`. Legacy positional IDs remain deprecated compatibility aliases until the next major version.

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

Boards can be selected by exact ID or key. Member, column, settings, favorite, and GitHub automation mutations require the same board access as the web application. Column moves use semantic `before`, `after`, `first`, or `last` placement. Removing an occupied column requires an explicit destination and is refused if the backend cannot guarantee an atomic migration.

`boards favorite get` is represented by `boards get` and the favorite field in its response; the mutation commands are listed separately above.

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

Ticket IDs and keys are exact selectors. Board-scoped list/create/import commands require exactly one board ID or board key. Ticket mutations cover the web application's lifecycle, comments, assignments, relationships, blockers, hierarchy, acceptance criteria, documents, and GitHub development data.

Ticket imports accept JSON or CSV from a file or standard input, never both:

```sh
kooyahq tickets import preview --board-key OPS --file tickets.csv
kooyahq tickets import apply --board-key OPS --stdin --format json
```

Input must be UTF-8 and is limited to 5 MiB and 250 tickets. CSV headers are allowlisted. Quoted CSV fields and the frontend's flattened JSON fields are normalized locally.

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

Timer mutations always act on the authenticated key owner. A timer ID is optional for pause, resume, and stop only when exactly one eligible timer exists; the CLI never guesses among multiple timers. `start-many` accepts at most 20 unique projects. Team entry reads require `--scope team`, and `--user-id` is rejected without that explicit scope. The backend still checks the user's time-entry permission.

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

Time, team, project, and cost summaries require explicit calendar dates and reject ranges longer than 366 days. Cost analytics and budget writes require their corresponding backend permissions. The CLI does not expose privileged salary/rate fields unless the backend route and acting user explicitly authorize them.

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

`users list --all --output json` is the assignment-friendly user lookup. Management, client creation, salary fields, activity logs, exports, permission changes, and templates remain permission-gated by the backend. Use `users export --format csv --output raw` for a CSV stream.

### Notifications

```text
notifications list
notifications count
notifications mark-read
notifications mark-all-read
```

Notifications are always scoped to the authenticated user. Lists are paginated and support `--unread-only true|false`.

## Common flags and scripting

Paginated list commands support:

```text
--page <positive-integer>
--limit <positive-integer>
--sort <allowlisted-field>
--order <asc|desc>
--all
```

Global command behavior:

- `--output table` is the human-readable default.
- `--output json` preserves structured API responses.
- `--output raw` is intended for text exports.
- `--dry-run` validates and prints the request without reading credentials or sending traffic.
- `--all` fetches paginated GET results sequentially, with a 1,000-page safety cap.
- `--yes` skips a documented confirmation; it is rejected on commands that do not support it.
- Mutations are never retried. GET transport failures are retried at most twice after the first attempt.

Examples:

```sh
kooyahq boards get --board-key OPS --output json
kooyahq boards members add --board-key OPS --user-id user_123 --role member --dry-run
kooyahq tickets list --board-key OPS --assignee-id user_123 --sort priority --order desc --all --output json
kooyahq tickets create --board-key OPS --ticket-type task --title "Release" --assignee-id user_123 --dry-run
kooyahq tickets blockers add --ticket-key OPS-42 --blocker-ticket-key OPS-12
kooyahq time timers start-many --projects Project-A,Project-B --task "Review"
kooyahq time entries list --scope team --user-id user_123 --start-date 2026-07-01 --end-date 2026-07-25 --output json
kooyahq analytics team --start-date 2026-07-01 --end-date 2026-07-25 --output json
kooyahq notifications list --unread-only true --all --output json
kooyahq users list --search "Alex" --all --output json
```

## Authorization, auditing, and security

The CLI is a typed wrapper around HTTPS requests; it is not a permission bypass. Every request is authenticated by the backend and evaluated as the access-key owner. Board membership, board roles, time-entry scopes, user-management permissions, analytics permissions, and administrator permissions remain authoritative server-side.

Accepted CLI requests are audited in KooyaHQ with the acting user, access-key ID, canonical command/action, source IP, reported CLI version/platform, and timestamp. Audit records do not store the request body, response body, or secret. CLI access audits use the dedicated administrator-log permission and a 180-day rolling retention window.

Client security behavior:

- No request is sent for blank or partial configuration.
- Credentials are sent only to the validated origin with `Authorization: KooyaKey <id>:<secret>`.
- Redirects are rejected so credentials cannot cross origins.
- Requests time out after 30 seconds and response bodies are limited to 10 MiB.
- Secrets are never printed by `configure show`, help, skills, or dry-run output.
- Reflected credentials are redacted from API error messages.
- Configuration uses private filesystem permissions and atomic writes.
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
- `tsc: not found` during installation: fetch the current `main` and reinstall. Supported GitHub installs use committed `dist/` files and do not compile TypeScript.
- SSH or repository error: verify `ssh -T git@github.com` and `git ls-remote git@github.com:KooyaPH/kooyahq_cli.git`.
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
git diff --exit-code -- dist
npm audit --omit=dev
```

CI verifies Node.js 18, 20, 22, and 24 on Linux, checks that committed `dist/` matches the TypeScript source, packs and installs the artifact, and smoke-tests Linux, macOS, and Windows. The repository has no npm publication or deployment workflow.
