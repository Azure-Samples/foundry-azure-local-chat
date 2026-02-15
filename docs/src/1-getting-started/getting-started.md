---
order: 1
---

# Getting Started

## Prerequisites

- Node.js 18+
- npm

## Installation

```bash
# Clone the repository
git clone <repository-url>
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
# Configure the server (see server/README.md)
cp server/.env.example server/.env
# Edit server/.env with your credentials

# Start both frontend and server
npm run dev:all
```

### Option 3: Your Own Backend

Point to your own server that implements the [API contract](./architecture.md#api-contract):

```env
# .env
VITE_API_URL=https://your-server.com
```

## Development

```bash
npm run dev          # Frontend only
```

For reference server: `cd server && npm run dev` in a separate terminal.

### Dev Checker Overlay

ESLint and TypeScript errors are shown in the browser overlay. To disable:

```bash
VITE_DEV_CHECKER=false npm run dev
```

### Mock Mode

Server-side mock is controlled via `DATASOURCES` env var in server config:

```env
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

## Build

```bash
npm run build         # Standard build
npm run build:static  # Static build (relative paths)
```

## Linting

```bash
npm run lint          # Check for issues
npm run lint:fix      # Auto-fix issues
npm run lint:all      # Lint frontend + server
npm run typecheck     # TypeScript check
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
import { config } from '@/config/constants';

const title = config.get('app.title');
const maxWidth = config.get('layout.maxWidth');
```

See [configuration.md](/2-features/configuration.md) for all options.

### Localization

UI strings in `src/localization/en.ts`. See [localization.md](/2-features/localization.md).

## Reference Server

A reference Express server with Azure AI Foundry integration is included in `server/`. 

See [server/README.md](../server/README.md) for setup and configuration.

This is optional - implement your own server following the [API contract](./architecture.md#api-contract).

### Data Sources

The server supports two data source modes via `DATASOURCES` env var:

| Value | Description |
|-------|-------------|
| `mock` | In-memory mock storage (for UI development) |
| `api` | Azure AI Foundry (default - production) |

Toggle between modes at runtime:
```bash
# Check current mode
curl http://localhost:3001/api/admin/datasource

# Toggle mode
curl -X POST http://localhost:3001/api/admin/datasource/toggle
```

---
*Last updated: 2026-02-10*
