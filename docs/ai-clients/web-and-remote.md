# Hosted and web AI clients

## Current support

**Remote gateway required:** ChatGPT, the OpenAI Responses API, Replit Agent, Gemini web/API, Claude.ai, and any other hosted environment cannot run the local `kooyahq-mcp` stdio process. There is intentionally no `kooyahq mcp install --client chatgpt` or Replit installer.

## Why local installation is not safe

The local CLI uses a profile stored on the developer workstation. Exposing that profile through a tunnel, browser extension, copied environment variables, or shared configuration would bypass the required user identity and expand the credential's reach.

## Requirements before remote support

A separately reviewed production service must expose HTTPS Streamable HTTP or SSE MCP transport, authenticate each user, map permissions to KooyaHQ backend authorization, enforce the exact live project catalog for every mutation, require per-call approval, audit requests, apply rate and payload limits, redact sensitive output, publish health checks, and document credential revocation. This CLI release neither deploys nor configures that gateway.

## What to do today

Use one of the supported local clients on the same machine as the KooyaHQ CLI. For a hosted client request, treat it as an infrastructure project and obtain an approved remote-gateway design and deployment first.
