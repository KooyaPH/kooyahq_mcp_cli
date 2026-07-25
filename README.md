# KooyaHQ CLI

Private command-line access to the KooyaHQ API for authenticated KooyaHQ operators. The CLI targets `https://hq-be.kooyaai.com/api/cli/v1` by default and requires Node.js 18 or newer.

This package is private and is not published to npmjs.com. Install it from the private GitHub repository. There is no npm package publication and no release-tag requirement for internal installs.

## Install from GitHub

You need read access to `KooyaPH/kooyahq_cli`, Node.js 18 or newer, npm, Git, and a GitHub-authenticated SSH key. Confirm access before installing:

```sh
ssh -T git@github.com
git ls-remote git@github.com:KooyaPH/kooyahq_cli.git
```

Install or update from `main`:

```sh
npm install -g --install-links=true git+ssh://git@github.com/KooyaPH/kooyahq_cli.git#main
hash -r
kooyahq --version
kooyahq --help
```

`--install-links=true` is required for private GitHub installs. Without it, npm can leave `kooyahq-cli` as a dangling symlink into its temporary Git cache on some npm versions. `hash -r` refreshes the current shell's command lookup after installation. The GitHub package ships compiled `dist/` files on `main`. During installation npm runs a dependency-free package check against those committed files; it does not compile TypeScript on your machine. To remove it:

```sh
npm uninstall -g kooyahq-cli
```

There is deliberately no npm publication or deployment workflow.

### Windows

Use PowerShell, Git for Windows, and Node.js 18 or newer:

```powershell
ssh -T git@github.com
git ls-remote git@github.com:KooyaPH/kooyahq_cli.git
npm install -g --install-links=true git+ssh://git@github.com/KooyaPH/kooyahq_cli.git#main
kooyahq --version
kooyahq --help
```

Configuration is stored at `%USERPROFILE%\.kooyahq\config.json`. On Windows, the CLI applies private ACLs with `whoami` and `icacls` without invoking a shell; only the current account and `SYSTEM` are granted access.

### macOS and Linux

Use a POSIX shell, Git, OpenSSH, and Node.js 18 or newer:

```sh
ssh -T git@github.com
git ls-remote git@github.com:KooyaPH/kooyahq_cli.git
npm install -g --install-links=true git+ssh://git@github.com/KooyaPH/kooyahq_cli.git#main
hash -r
kooyahq --version
kooyahq --help
```

Configuration is stored at `~/.kooyahq/config.json`. The directory is set to `0700`, the config file is set to `0600`, and writes use a temporary file in the same directory followed by an atomic rename.

## Configure

Interactive configuration validates the credentials with `auth whoami` before saving them. The secret uses a hidden prompt and is never accepted as a command-line flag.

```sh
kooyahq configure
kooyahq configure show
kooyahq configure clear
```

`configure show` always prints the secret as `[REDACTED]`. A failed validation leaves the prior configuration untouched. Configuration is stored at:

- POSIX: `~/.kooyahq/config.json`
- Windows: `%USERPROFILE%\.kooyahq\config.json`

On POSIX, the directory and file are created with modes `0700` and `0600`. On Windows, inheritance is removed and access is restricted to the current account plus `SYSTEM`. Writes use a temporary file in the same directory followed by an atomic rename.

For non-interactive use, all three variables must be set together. They override the stored configuration as one complete set:

```sh
export KOOYAHQ_BASE_URL=https://hq-be.kooyaai.com
export KOOYAHQ_ACCESS_KEY_ID=your-access-key-id
export KOOYAHQ_SECRET_ACCESS_KEY=your-secret-access-key
kooyahq auth whoami --output json
```

The base URL must be an HTTPS origin with no path, user information, query, or fragment. Plain HTTP is accepted only for `localhost`, `127.0.0.1`, or `::1`. Missing, blank, or partial credentials stop before any network request.

## Command catalog

Arguments in angle brackets are positional IDs. Create and update commands require at least one documented data option.

### Authentication and projects

```text
auth whoami

projects list
projects get <id>
projects create
projects update <id>
projects delete <id> [--yes]
```

Project create requires `--name`. Project update requires at least one data option. Project data options: `--name`, `--emoji`, `--icon-url`.

### Boards

```text
boards list
boards get <id>
boards create
boards update <id>
boards delete <id> [--yes]
boards favorite <id>
boards settings get <id>
boards settings update <id>
boards members list <board-id>
boards members add <board-id>
boards members update-role <board-id> <user-id>
boards members remove <board-id> <user-id> [--yes]
```

Board create requires `--name` and `--type`; it also accepts `--description`, `--prefix`, `--emoji`, `--columns-json` (a JSON array), and `--settings-json` (a JSON object). Board update accepts the same fields except `--type`. In the v1 contract, `--settings-json` is limited to `defaultView` and `showSwimlanes`. `boards favorite` toggles the current favorite state. Settings update accepts `--default-view` and `--show-swimlanes true|false`. Member add requires `--user-id` and `--role`; update-role requires `--role`.

### Tickets and comments

```text
tickets list
tickets get <id>
tickets create
tickets update <id>
tickets delete <id> [--yes]
tickets comments list <ticket-id>
tickets comments create <ticket-id>
tickets comments update <ticket-id> <comment-id>
tickets comments delete <ticket-id> <comment-id> [--yes]
```

Ticket list requires `--board-id`. Ticket create requires `--board-id`, `--ticket-type`, and `--title`; it also accepts `--description-json` (a JSON object), `--column-id`, `--points`, `--priority`, comma-separated `--tags`, `--assignee-id`, `--acceptance-criteria-json` (a JSON array), `--start-date`, `--end-date`, and `--due-date`. Ticket update accepts the same mutable fields but excludes board ID and ticket type. The column ID is the ticket status column on its board. Comment create/update accepts `--content`.

### Time

```text
time timers list
time timers start
time timers pause [timer-id]
time timers resume [timer-id]
time timers stop [timer-id]
time timers stop-all [--yes]
time timers add-task <timer-id>

time entries list
time entries get <id>
time entries create
time entries update <id>
time entries delete <id> [--yes]
```

Timer start requires one `--project` and accepts optional free-text `--task` and `--is-overtime true|false`; the project is sent as a one-element `projects` array. Add-task requires free-text `--task`. Time-entry create requires comma-separated `--projects`, `--task`, and `--duration`; it also accepts `--start-time`, `--end-time`, and `--is-overtime true|false`. Time-entry update accepts only `--projects`, `--task`, and `--duration`. User IDs are never accepted for time operations.

Pause, resume, and stop accept an explicit timer ID. Without one, the CLI fetches the eligible timers (`running` for pause/stop, `paused` for resume) and proceeds only when exactly one is returned. Zero or multiple eligible timers is a validation error; the CLI never guesses. `stop-all` asks for confirmation unless `--yes` is present.

### Analytics

```text
analytics time
analytics team
analytics projects
analytics costs
```

Analytics requires both `--start-date` and `--end-date`.

### Users

```text
users list
users get <id>
users create
users update <id>
users delete <id> [--yes]
users stats
users permissions get <id>
users permissions update <id>
users templates list
users templates get <id>
```

User create requires `--name` and `--email`. User data options also include `--position`, `--birthday`, `--status`, comma-separated `--permissions`, and `--bio`. Update accepts those fields plus `--disabled true|false`. Permission updates accept a comma-separated `--permissions` value.

### Notifications

```text
notifications list
notifications count
```

Notification list accepts `--unread-only true|false`. Notification count has no filters.

## Lists, filters, and output

Every `list` command accepts:

```text
--page <positive-integer>
--limit <positive-integer>
--sort <field>
--order <asc|desc>
--output <table|json>
```

Relevant allowlisted filters are:

| List | Filters |
| --- | --- |
| projects | `--search` |
| boards | `--search`, `--type` |
| board members | `--search`, `--role` |
| tickets | required `--board-id`; optional `--search`, `--ticket-type`, `--column-id`, `--assignee-id`, `--priority`, `--archived` |
| ticket comments | `--author-id` |
| timers | `--status running|paused` |
| time entries | `--project`, `--active`, `--paused`, `--start-date`, `--end-date` |
| users | `--search`, `--include-disabled` |
| user templates | `--search` |
| notifications | `--unread-only` |

Examples:

```sh
kooyahq projects list --page 2 --limit 50 --sort name --order asc
kooyahq tickets list --board-id board_123 --column-id column_456 --search "release review" --output json
kooyahq tickets create --board-id board_123 --ticket-type task --title "Release" --tags release,urgent --description-json '{"type":"doc"}'
kooyahq time timers start --project project_123 --task "Release review"
kooyahq time entries list --project project_123 --start-date 2026-07-01 --end-date 2026-07-31 --output json
kooyahq analytics time --start-date 2026-07-01 --end-date 2026-07-31 --output json
kooyahq boards members update-role board_123 user_456 --role admin --output json
kooyahq users permissions update user_456 --permissions projects:view,board:update
```

Options are converted with `URLSearchParams`; CLI `--sort` and `--order` map to API `sortBy` and `sortOrder`. Sort fields are allowlisted to common server fields: `createdAt`, `updatedAt`, `name`, `title`, `email`, `status`, `priority`, `duration`, `startTime`, `endTime`, and `occurredAt`. Unknown filters or unsupported sort fields are rejected instead of being sent to the API. JSON flags must parse to the documented object or array shape. Table output is the default. JSON output preserves the API response for scripting. Empty successful mutation responses print `Success.` in table mode.

## Permissions and exit codes

Access keys are scoped by the server. The CLI does not elevate access: authentication proves the key pair, while project, board, ticket, time, analytics, user, template, permission, and notification operations still require their corresponding server-side permissions.

| Code | Meaning |
| --- | --- |
| `0` | Success or user-cancelled confirmation |
| `1` | Network or server failure |
| `2` | Configuration or local validation failure |
| `3` | Authentication failure (`401`) |
| `4` | Authorization failure (`403`) |
| `5` | Not found or conflict (`404`/`409`) |

## Security and revocation

- Requests use `Authorization: KooyaKey <id>:<secret>` only over the validated origin and API root.
- Redirect following is disabled, which prevents credentials crossing to another origin.
- Requests have a 30-second timeout and responses are capped at 10 MiB before JSON parsing.
- The CLI never logs credentials and redacts credentials if an API error reflects them.
- Do not place secrets in shell history, tickets, chat, screenshots, or repository files. Prefer the hidden prompt or a protected CI secret store.
- To revoke access, revoke/rotate the access key in KooyaHQ, run `kooyahq configure clear`, and remove any environment or CI secret values. Clearing the local file alone does not revoke a server-side key.

## Troubleshooting

- `KooyaHQ is not configured`: run `kooyahq configure`, or set all three environment variables.
- `must be set together`: remove partial environment variables or provide the complete set.
- Exit `3`: the key is missing, expired, revoked, or copied incorrectly. Reissue it; do not paste it into diagnostics.
- Exit `4`: the authenticated key lacks the required permission. Ask a KooyaHQ administrator to review its scope.
- SSH install failure: verify repository membership, SSH-agent state, and `ssh -T git@github.com`.
- `tsc: not found` during `npm install -g git+ssh://...`: update to the latest `main` and reinstall. Current GitHub installs use committed `dist/` files and do not require TypeScript on the target machine.
- `TAR_ENTRY_ERROR ENOENT .../dist/...` followed by `kooyahq: command not found`, `ENOTDIR: not a directory, rename .../node_modules/kooyahq-cli`, or `ENOTEMPTY: directory not empty, rename .../node_modules/kooyahq-cli`: remove stale global symlinks, clear npm's cache index, and reinstall. On macOS/Linux with nvm:

  ```sh
  npm uninstall -g kooyahq-cli || true
  global_prefix="$(npm prefix -g)"
  package_path="$global_prefix/lib/node_modules/kooyahq-cli"
  bin_path="$global_prefix/bin/kooyahq"
  test -L "$bin_path" && unlink "$bin_path"
  test -L "$package_path" && unlink "$package_path"
  if [ -e "$package_path" ]; then
    echo "Refusing to remove non-symlink package path: $package_path"
    exit 1
  fi
  npm cache verify
  npm install -g --install-links=true git+ssh://git@github.com/KooyaPH/kooyahq_cli.git#main
  hash -r
  kooyahq --version
  ```

  In Windows PowerShell:

  ```powershell
  npm uninstall -g kooyahq-cli
  $globalPrefix = npm prefix -g
  $globalModules = npm root -g
  $packagePath = Join-Path $globalModules 'kooyahq-cli'
  $binPath = Join-Path $globalPrefix 'kooyahq.cmd'
  Remove-Item -Force $binPath -ErrorAction SilentlyContinue
  if ((Test-Path $packagePath) -and ((Get-Item $packagePath).Attributes -band [IO.FileAttributes]::ReparsePoint)) {
    Remove-Item -Force $packagePath
  }
  if (Test-Path $packagePath) {
    throw "Refusing to remove non-symlink package path: $packagePath"
  }
  npm cache verify
  npm install -g --install-links=true git+ssh://git@github.com/KooyaPH/kooyahq_cli.git#main
  kooyahq --version
  ```
- TLS/network failure: check the configured origin and corporate proxy/firewall. Redirects are intentionally rejected.
- Timer ambiguity: rerun `time timers list --output json`, then supply the intended timer ID explicitly.
