# KooyaHQ CLI installation

KooyaHQ CLI is a private GitHub package. It requires Node.js 18 or newer, npm, Git, SSH access to GitHub, and read access to `KooyaPH/kooyahq_cli`.

## Shared prerequisites

On every platform, use Node.js 18 or newer, npm, Git, SSH access to GitHub, and read access to `KooyaPH/kooyahq_cli`. Verify access before installation:

```sh
ssh -T git@github.com
git ls-remote git@github.com:KooyaPH/kooyahq_cli.git
```

## Linux

```sh
npm install -g --install-links=true git+ssh://git@github.com/KooyaPH/kooyahq_cli.git#main
hash -r
kooyahq --version
kooyahq-mcp --version
```

## macOS

Install Node.js 18 or newer from nodejs.org or your approved package manager, then run:

```sh
npm install -g --install-links=true git+ssh://git@github.com/KooyaPH/kooyahq_cli.git#main
hash -r
kooyahq --version
kooyahq-mcp --version
```

## Windows

Install Node.js 18 or newer and Git for Windows. In PowerShell, run:

```powershell
ssh -T git@github.com
git ls-remote git@github.com:KooyaPH/kooyahq_cli.git
npm install -g --install-links=true git+ssh://git@github.com/KooyaPH/kooyahq_cli.git#main
kooyahq --version
kooyahq-mcp --version
```

The package installs committed `dist/` JavaScript, so the target machine does not need TypeScript. `hash -r` is not required in PowerShell.

## Configure the KooyaHQ API profile

Create an access key in the signed-in KooyaHQ profile, then run:

```sh
kooyahq configure
kooyahq auth whoami --output json
```

The secret is accepted only by the hidden prompt. `kooyahq configure show` redacts it. Do not paste credentials into command arguments, documentation, chat, or screenshots.

## Install the Codex integration

After configuration succeeds, run the same commands on Linux, macOS, or Windows:

```sh
kooyahq mcp install --client codex
kooyahq mcp doctor --client codex
kooyahq mcp doctor --client codex --online
```

The installer registers only the `kooyahq` MCP entry, using absolute Node.js and server-script paths. It publishes the self-contained `SKILL.md` with an atomic file rename under a scoped install lock, publishes `VERSION` last as the completion marker, and removes obsolete files only inside its own `kooyahq-cli` skill directory. It does not alter `kooyahq-workflow` or other skills. Re-running it is safe. When `CODEX_HOME` is set it must be absolute and is used by both registration and skill checks; otherwise the root is `~/.codex`. Restart Codex and open a new thread after installation.

The offline doctor checks local files, Codex registration, the MCP handshake, the exact tool list, and skill version. `--online` additionally runs an authenticated profile check without printing credentials.

## Remove

```sh
codex mcp remove kooyahq
npm uninstall -g kooyahq-cli
hash -r
```

Remove the installed skill at `${CODEX_HOME}/skills/kooyahq-cli` when `CODEX_HOME` is set, or `~/.codex/skills/kooyahq-cli` otherwise. Do not remove the separate `kooyahq-workflow` skill.

Removing the local package does not revoke an access key. Revoke a compromised key in KooyaHQ and run `kooyahq configure clear` when local credentials must also be removed.

## Repair stale installations

If `command -v kooyahq` or `command -v kooyahq-mcp` points to a missing package file, uninstall and reinstall the package, then run `hash -r`. A stale or dangling npm shim can exist even though a command name still appears in a shell lookup.

If installation reports `tsc: not found`, reinstall current `main` with `--install-links=true`. Supported installs use committed `dist/` and do not compile TypeScript.
