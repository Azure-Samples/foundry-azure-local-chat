# Server

Express backend server implementing the **Responses API (Atomic Pattern)** with Azure AI Foundry integration.

> **Note:** This is a reference implementation. Pure proxy to Azure AI Foundry - you can replace with your own backend (OpenAI, custom AI, etc.) as long as it implements the API contract.

## Quick Start

```bash
# From project root
npm run server:dev

# Or directly
cd server && npm run dev
```

## Configuration

Copy `.env.example` to `.env` and configure:

```env
# Server
SERVER_PORT=3001
CORS_ORIGINS=http://localhost:5173

# Admin Routes (optional)
# Enable in production for runtime configuration
# Always enabled in development mode
ENABLE_ADMIN_ROUTES=false

# Data Sources: "api" or "mock" (toggleable at runtime)
DATASOURCES=api

# Streaming: "enabled" or "disabled" (toggleable at runtime)
STREAMING=enabled

# Azure AI Foundry (required when DATASOURCES=api)
AI_PROJECT_ENDPOINT=https://your-project.services.ai.azure.com/api/projects/your-project
AI_AGENT_ID=your-agent-name:version

# Authentication: "entra" (recommended) or "apikey"
AI_AUTH_METHOD=entra
# AI_API_KEY= (only required if AI_AUTH_METHOD=apikey)
```

### Data Sources

| Value | Description |
|-------|-------------|
| `api` | Azure AI Foundry (default) |
| `mock` | In-memory mock storage (no Azure needed) |

Toggle at runtime:
```bash
curl -X POST http://localhost:3001/api/admin/datasource/toggle
```

### Streaming

Toggle at runtime:
```bash
curl -X POST http://localhost:3001/api/admin/streaming/toggle
```

### Admin Routes

Admin routes provide runtime configuration endpoints for testing and development.

**Security:**
- In **development** (NODE_ENV !== "production"): Always enabled
- In **production**: Requires `ENABLE_ADMIN_ROUTES=true` environment variable

**Available endpoints:**
```bash
# View current configuration
curl http://localhost:3001/api/admin/config

# Toggle data source (mock ↔ api)
curl -X POST http://localhost:3001/api/admin/datasource/toggle

# Toggle streaming (enabled ↔ disabled)
curl -X POST http://localhost:3001/api/admin/streaming/toggle
```

**Enabling in production:**
- Set during Azure setup: `./scripts/setup-azure.sh` (interactive prompt)
- Or manually in Azure Portal: App Service → Configuration → `ENABLE_ADMIN_ROUTES=true`
- Or in local production build: Add to `.env` file

## Authentication

Uses Azure Entra ID via `DefaultAzureCredential` which automatically handles:

| Environment | Auth Method |
|-------------|-------------|
| Local dev | `az login` |
| Azure App Service | Managed Identity |
| Azure Container Apps | Managed Identity |
| GitHub Actions | Workload Identity |

No API keys needed - authentication is handled automatically based on your environment.

## Architecture

This server implements the **Atomic Pattern** (Responses API):

- **Single API call** handles: conversation creation + user message + AI response
- **No orphan messages** - both user and assistant messages are persisted together
- **Refresh-safe** - if user refreshes mid-request, nothing is saved (clean state)

### Technology Stack

- Express.js 4.x
- TypeScript
- `@azure/ai-projects` - Azure AI Foundry SDK
- `openai` package for API types
- `@azure/identity` for authentication
- CORS with configurable origins

## API Endpoints

### Responses (Primary - Atomic Pattern)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/responses` | **Send message + get response (ATOMIC)** |
| GET | `/api/responses/:id` | Check response status (rarely needed) |

### Conversations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/conversations` | List all conversations |
| GET | `/api/conversations/:id` | Get conversation details |
| PATCH | `/api/conversations/:id` | Update conversation (title in metadata) |
| DELETE | `/api/conversations/:id` | Delete conversation |
| GET | `/api/conversations/:id/items` | List conversation messages |

### Request/Response Examples

**Send Message (Atomic):**
```json
POST /api/responses
{
  "input": "Hello!",
  "conversationId": "conv_abc123"  // optional - creates new if not provided
}

Response:
{
  "conversationId": "conv_abc123",
  "isNew": false,
  "response": {
    "id": "resp_xyz",
    "status": "completed",
    "output": [
      {
        "id": "msg_abc",
        "type": "message",
        "role": "assistant",
        "content": [{ "type": "output_text", "text": "Hi! How can I help?" }],
        "status": "completed"
      }
    ]
  }
}
```

**Streaming Response:**
```json
POST /api/responses
{
  "input": "Tell me a story",
  "conversationId": "conv_abc123",
  "stream": true
}

// Returns Server-Sent Events stream
```

**List Conversations:**
```json
GET /api/conversations

Response:
[
  {
    "id": "conv_abc123",
    "object": "conversation",
    "created_at": 1234567890,
    "metadata": { "title": "My Chat" }
  }
]
```

**List Messages:**
```json
GET /api/conversations/conv_abc123/items

Response:
{
  "data": [
    {
      "id": "msg_abc",
      "type": "message",
      "role": "user",
      "content": [{ "type": "text", "text": "Hello!" }],
      "status": "completed"
    },
    {
      "id": "msg_xyz",
      "type": "message",
      "role": "assistant",
      "content": [{ "type": "output_text", "text": "Hi!" }],
      "status": "completed"
    }
  ],
  "last_id": "msg_xyz",
  "has_more": false,
  "object": "list"
}
```

### Health Check

```
GET /api/health

Response:
{
  "status": "ok",
  "mode": "azure" | "mock",
  "timestamp": 1234567890
}
```

## Atomic Pattern Benefits

The `/api/responses` endpoint follows the **Atomic Pattern**:

1. **Single Request** - Send message + receive response in one call
2. **No Orphans** - Both messages are persisted together, or not at all
3. **Refresh Safe** - User refreshes mid-request? Nothing saved
4. **Simple Client** - No polling, no status tracking, no complex state

See [../docs/CONVERSATION_PATTERNS.md](../docs/CONVERSATION_PATTERNS.md) for detailed comparison with the old Assistants API pattern.

## Mock Provider Architecture

The mock system is cleanly separated for easy removal:

```
server/
├── providers/
│   ├── mock/              # DELETE THIS FOLDER to remove mock
│   │   ├── index.ts
│   │   ├── store.ts       # In-memory storage
│   │   └── utils/         # Mock helpers (streaming)
│   ├── index.ts
│   └── types.ts           # Shared interfaces
├── routes/
│   ├── mock/              # DELETE THIS FOLDER to remove mock
│   │   ├── conversations.mock.route.ts
│   │   ├── items.mock.route.ts
│   │   └── responses.mock.route.ts
│   └── index.ts           # Uses createHybridRouter for dynamic switching
```

### To Remove Mock Entirely:

1. Delete `/server/providers/mock` folder
2. Delete `/server/routes/mock` folder
3. In `/server/routes/index.ts`:
   - Remove: `import { mock* } from "./mock"`
   - Remove: `createHybridRouter` usage
   - Use API routes directly: `app.use("/api/conversations", conversationsRoutes)`
4. Remove `DATASOURCES` from `.env` (defaults to api)
5. Remove admin toggle endpoints if not needed

## CORS

Configured via `CORS_ORIGINS` env var (comma-separated, **required**):

```env
CORS_ORIGINS=https://your-app.z6.web.core.windows.net,http://localhost:5173
```

Server will not start without this configured.

## Development

```bash
npm run dev           # Start with ESLint watch
npm run dev:no-lint   # Start without ESLint
npm run lint          # Run ESLint
npm run lint:fix      # Auto-fix ESLint errors
```

## Azure Deployment

See [docs/azure-deployment.md](./docs/azure-deployment.md) for complete deployment guide.

---
*Last updated: 2026-02-09*
