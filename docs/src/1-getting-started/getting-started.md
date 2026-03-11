---
order: 1
---

# Getting Started

## Prerequisites

- Node.js 20+
- npm

> **Tip:** Skip all local setup by using the included [Dev Container](/3-development/devcontainer). Open in GitHub Codespaces or VS Code Dev Containers and everything is pre-configured.

## Installation

```bash
# Clone the repository
git clone https://your-repo-url
cd Edge-Core-Chat

# Install dependencies
npm install
```

## Quick Start

### Option 1: Mock Mode (No Backend)

For UI development without a backend:

```bash
npm run dev
```

The app runs at http://localhost:5173 with mock responses enabled by default.

### Option 2: With Reference Server

To use the included Azure AI Foundry server:

```bash
# Configure the server
cp server/.env.example server/.env
# Edit server/.env with your AI Foundry credentials

# Terminal 1: Start frontend
npm run dev

# Terminal 2: Start server
cd server && npm run dev
```

### Option 3: Your Own Backend

Point to your own server that implements the [API contract](./architecture.md#api-contract):

```sh
# .env
VITE_API_URL=https://your-server.com
```

## Development

```bash
npm run dev          # Frontend (Vite dev server)
npm run build        # Production build
npm run build:static # Build with relative paths
npm run lint         # ESLint check
npm run lint:fix     # ESLint auto-fix
npm run typecheck    # TypeScript check
```

### Dev Checker Overlay

ESLint and TypeScript errors are shown in the browser overlay. To disable:

```bash
VITE_DEV_CHECKER=false npm run dev
```

### Mock Mode

Server-side mock is controlled via `DATASOURCES` env var in server config:

```sh
# server/.env
DATASOURCES=mock       # Mock only (for UI development)
DATASOURCES=api        # API only (default - requires Azure AI Foundry)
```

Toggle at runtime:

```bash
curl -X POST http://localhost:3001/api/admin/datasource/toggle
```

### Streaming Mode

Toggle streaming at runtime:

```bash
curl -X POST http://localhost:3001/api/admin/streaming/toggle
```

## Configuration

### Theme

Set via:

1. Query parameter: `?theme=dark`
2. localStorage: `app-theme` key
3. System preference (fallback)

### App Configuration

Centralized in `src/config/constants.ts`:

```typescript
import { config } from "@/config/constants";

const title = config.get("app.title");
const maxWidth = config.get("layout.maxWidth");
```

See [configuration.md](/2-features/configuration.md) for all options.

### Localization

UI strings in `src/localization/en.ts`.

## Reference Server

A reference Express server with Azure AI Foundry integration is included in `server/`.

See [server/README.md](../../../server/README.md) for setup and configuration.

This is optional - implement your own server following the [API contract](./architecture.md#api-contract).

## Azure Deployment

### Recipe-Based Deploy (recommended)

The fastest way to deploy - a recipe sets all defaults for you:

```bash
azd env set RECIPE all    # full stack + AI Foundry (gpt-4o-mini, D2s_v3, 2 nodes)
azd up                    # prompts for subscription + location, recipe handles the rest
```

Available recipes:

| Recipe | What you get                                                   |
| ------ | -------------------------------------------------------------- |
| `all`  | Full stack + AI Foundry (gpt-4o-mini, D2s_v3, 2 nodes)         |
| `dev`  | Full stack + mock AI (B2s cheapest VM, admin enabled, CORS=\*) |

> **Note:** `ARC_PREFIX` is auto-derived from the azd environment name. `azd env new my-chat` creates `my-chat-rg`, `my-chat-cluster`, etc.

### Interactive Wizard

Run `azd up` without setting `RECIPE` to walk through the interactive wizard with arrow-key navigation. The wizard prompts for region, VM size, AI mode, deploy scope, and more.

```bash
azd up    # no RECIPE set = wizard mode
```

### CI / Automation

For non-interactive pipelines, use a recipe with `-y`:

```bash
azd env new my-chat
azd env set RECIPE all
azd up -- -y
```

Or set individual env vars for full control:

```bash
azd env new my-chat
azd env set DEPLOY_MODE "k8s"
azd env set VM_SIZE "Standard_D2s_v3"
azd env set AI_MODE "create"
azd up -- -y
```

### Resume Existing Deployment

Already deployed from another machine? Resume with just the env name and subscription:

```bash
azd env new <existing-prefix>
azd env set AZURE_SUBSCRIPTION_ID <sub-id>
azd up    # auto-detects everything from Azure + K8s
```

See [deployment.md](../3-development/deployment.md) for the full environment variable reference and deployment cookbooks.

---

_Last updated: 2026-03-05 | Last commit: cb3b21b_
