# Edge Core Chat

A reusable Chat UI template for AI experiences. Uses OpenAI Conversations API standard. Bring your own backend or use our Azure AI Foundry reference implementation.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Documentation](#documentation)
- [Backend Options](#backend-options)
- [Status](#status)

## Overview

Edge Core Chat provides a production-ready chat interface with **backend flexibility**:
- Use our Azure AI Foundry server (included)
- Implement your own OpenAI-compatible backend
- Develop UI in mock mode (no backend needed)

**Key Features:**
- OpenAI Conversations API standard (future-proof)
- Pure TypeScript types from `openai` package
- Copilot-like experience with Fluent AI components
- Mock mode for UI development
- Theme support (Light/Dark/System)
- Type-safe configuration
- Accessible and responsive

## Quick Start

### Option 1: Mock Mode (No Backend)

```bash
npm install
npm run dev
```

### Option 2: With Reference Server

```bash
npm install
cp server/.env.example server/.env
# Edit server/.env with your Azure credentials

# Start server (separate terminal)
cd server && npm run dev

# Start frontend (separate terminal)
npm run dev
```

### Option 3: Your Own Backend

Implement the OpenAI Conversations API and point to your server.

See [Getting Started](docs/src/1-getting-started/getting-started.md) for full setup.

## Documentation

### Core Docs

| Document | Description |
|----------|-------------|
| [Getting Started](docs/src/1-getting-started/getting-started.md) | Installation and setup |
| [Architecture](docs/src/1-getting-started/architecture.md) | API contract, structure |
| [Chat Component](docs/src/2-features/chat-component.md) | Using the Chat component |
| [Configuration](docs/src/2-features/configuration.md) | App configuration |
| [Styling](docs/src/2-features/styling.md) | Customizing appearance |
| [Deployment](docs/src/3-development/deployment.md) | Frontend + Azure deployment (azd) |
| [Stack](docs/src/1-getting-started/stack.md) | Technology stack |
| [Plan](docs/src/3-development/plan.md) | Development roadmap |

### Reference Server Docs

| Document | Description |
|----------|-------------|
| [Server Setup](server/README.md) | Configuration and API |
| [Deployment](docs/src/3-development/deployment.md) | Deploy to Azure (azd) |

## Backend Options

### 1. Use Our Azure AI Foundry Server

Included in `server/` - ready to use with Azure AI Foundry agents.

[Setup Guide](server/README.md) | [Deployment](docs/src/3-development/deployment.md)

### 2. Implement Your Own

Your backend must implement OpenAI Conversations API endpoints:
- `POST /conversations` - Create conversation
- `GET /conversations/:id/items` - List messages
- `POST /responses` - Generate response (streaming/non-streaming)

See [API Contract](docs/src/1-getting-started/architecture.md#api-contract) for details.

**Examples:**
- Next.js API routes with OpenAI
- Azure Functions
- AWS Lambda
- Any REST API

## License

MIT

---
*Last updated: 2026-02-24*
