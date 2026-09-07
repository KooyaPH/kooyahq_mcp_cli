# KooyaHQ MCP for Hermes Agent

Hermes Agent can start the KooyaHQ stdio server locally through its configuration. Its CLI does not expose a stable descriptor query that this installer can use to prove an existing entry is safe to replace, so registration is deliberately manual.

## Install

```sh
kooyahq mcp manual --client hermes
```

The command prints an absolute `mcp_servers.kooyahq` YAML entry for `~/.hermes/config.yaml` on this operating system. Review any existing `kooyahq` entry before replacing it. The command does not invoke Hermes or import, migrate, or expose the KooyaHQ profile.

## Verify

```sh
hermes mcp test kooyahq
```

Restart Hermes after its own test succeeds and confirm that exactly three KooyaHQ tools are exposed. The KooyaHQ CLI cannot attest to Hermes' persisted descriptor, so there is no green `kooyahq mcp doctor --client hermes` command.

## Use safely

Begin with status and discovery. List projects and use one exact returned display name in top-level `project` for mutations. Send `confirm: true` and `dryRun: true` before the real call, then read back and clean up. MCP project creation is not permitted.

## Troubleshooting and recovery

If the Hermes test fails, print fresh YAML with `kooyahq mcp manual --client hermes`, compare it to the existing entry, and repair the entry through the Hermes configuration workflow. If online authentication fails, use `kooyahq configure` rather than placing secrets in Hermes MCP configuration.
