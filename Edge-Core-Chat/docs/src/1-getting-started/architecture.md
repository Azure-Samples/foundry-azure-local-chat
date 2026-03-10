---
order: 2
---

# Architecture

## System Overview

```mermaid
flowchart LR
    A["React App<br/>(Frontend)"] -->|Responses API| B["Your Server<br/>(Backend)"]
    B -->|Workload Identity| C["Azure AI Foundry<br/>or OpenAI, etc."]

    style A fill:#0366d6,color:#fff
    style B fill:#0d6e3e,color:#fff
    style C fill:#6f42c1,color:#fff
```

The frontend connects to **any backend** implementing the OpenAI Conversations API contract. You can use the included reference server, bring your own backend (BYOB), or implement the API contract from scratch.

## Project Structure

<LiteTree>
---
- Edge-Core-Chat/
    + src/                          // Frontend React app
        components/
        config/
        context/
        hooks/
        localization/
        services/
        styles/
        types/
        utils/
        routes.tsx
        main.tsx
    + server/                       // Reference server (optional)
    + infra/                        // Bicep + K8s manifests
        + modules/
        + modes/
            k8s/
            containerapp/
    + hooks/                        // azd lifecycle hooks
    + scripts/                      // Dev utilities
    vite.config.ts
</LiteTree>

## Pluggable Provider Pattern

Both the client and server use pluggable providers, making every layer swappable:

### Client-Side Providers

The frontend has a `chatApi` service layer with pluggable implementations:

```mermaid
flowchart LR
    A["React Hooks"] --> B["chatApiFactory"]
    B --> C["ChatApiService<br/>(standard HTTP)"]
    B --> D["StreamingChatApiService<br/>(SSE streaming)"]

    style C fill:#0366d6,color:#fff
    style D fill:#0366d6,color:#fff
```

The factory auto-detects the server mode via `GET /api/settings` and lazy-loads the matching implementation. See [services.md](/2-features/services.md) for API details.

### Server-Side Providers

The reference server uses a `DataProvider` interface to abstract data sources:

```mermaid
flowchart LR
    A["Express Routes"] --> B["getProvider()"]
    B --> C["ApiProvider<br/>(Azure AI Foundry)"]
    B --> D["MockProvider<br/>(in-memory)"]

    style C fill:#0d6e3e,color:#fff
    style D fill:#b08800,color:#fff
```

Routes call `getProvider()` based on the `DATASOURCES` env var. See [services.md](/2-features/services.md#server-side-dataprovider) for implementation details.

## Atomic Pattern (Responses API)

Message handling follows the **Atomic Pattern** - a single API call creates the conversation (if needed), processes the message, and persists both user and assistant messages together:

```mermaid
flowchart LR
    A["POST /api/responses"] --> B["Create conversation<br/>(if needed)"]
    B --> C["Process message<br/>with AI agent"]
    C --> D["Persist BOTH<br/>atomically"]
    D --> E["Response"]

    style A fill:#0366d6,color:#fff
    style E fill:#0d6e3e,color:#fff
```

**Benefits:** Single API call, no orphan messages, refresh-safe (nothing saved mid-request), no polling or status tracking.

## API Contract

Your server must implement these endpoints:

| Method | Endpoint                       | Description                              |
| ------ | ------------------------------ | ---------------------------------------- |
| POST   | `/api/responses`               | **Send message + get response (ATOMIC)** |
| GET    | `/api/conversations`           | List all conversations                   |
| GET    | `/api/conversations/:id`       | Get conversation details                 |
| PATCH  | `/api/conversations/:id`       | Update conversation (title)              |
| DELETE | `/api/conversations/:id`       | Delete conversation                      |
| GET    | `/api/conversations/:id/items` | List messages (paginated)                |

All types come from the `openai` npm package - see [types.md](/2-features/types.md) for type definitions and [services.md](/2-features/services.md) for request/response examples and custom backend implementation.

## Component Architecture

```mermaid
flowchart LR
    A["AppProviders"] --> B["ThemeProvider"]
    A --> C["CopilotProvider"]
    C --> D["AppRoutes"]
    D --> E["ChatPage"]
    E --> F["ChatHistory"]
    E --> G["Chat"]

    style A fill:#6f42c1,color:#fff
    style E fill:#0366d6,color:#fff
```

Services are instantiated via factory, consumed by [hooks](/2-features/hooks.md), and passed as props to [components](/2-features/chat-component.md). Configuration happens at the page/hook level - the Chat component is pure presentation.

## Environment Configuration

```sh
# Frontend .env
VITE_API_URL=https://your-server.com       # Production API URL

# Server .env
DATASOURCES=api                            # "api" or "mock"
STREAMING=enabled                          # "enabled" or "disabled"
```

Toggle between mock and API at runtime (development only - disabled in production unless `ENABLE_ADMIN_ROUTES=true`):

```bash
curl -X POST http://localhost:3001/api/admin/datasource/toggle
```

## Reference Server

An Express server is included in `server/`. See [server/README.md](../server/README.md) for setup. This is optional - implement the [API contract](#api-contract) above with any backend.

## Patches

Fluent Copilot component fixes via `patch-package`:

- ChatInput overflow and button positioning

Applied automatically on `npm install`.

---

_Last updated: 2026-02-24_
