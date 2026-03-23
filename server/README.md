# Server

Express backend server implementing the **Responses API (Atomic Pattern)** with Microsoft Foundry integration.

> **Note:** This is a reference implementation. Pure proxy to Microsoft Foundry - you can replace with your own backend (OpenAI, custom AI, etc.) as long as it implements the API contract.

## Quick Start

```bash
# From project root
npm run server:dev

# Or directly
cd server && npm run dev
```

## Configuration

Copy `.env.example` to `.env` and configure:

```sh
# Server
SERVER_PORT=3001
CORS_ORIGINS=http://localhost:5173

# Data Sources: "api" or "mock" (toggleable at runtime)
DATASOURCES=api

# Streaming: "enabled" or "disabled" (toggleable at runtime)
STREAMING=enabled

# Microsoft Foundry (required when DATASOURCES=api)
AI_PROJECT_ENDPOINT=https://your-project.services.ai.azure.com/api/projects/your-project
AI_AGENT_ID=your-agent-name:version
```

### Data Sources

| Value  | Description                              |
| ------ | ---------------------------------------- |
| `api`  | Microsoft Foundry (default)               |
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

## Authentication

Uses Azure Entra ID via `DefaultAzureCredential` which automatically handles:

| Environment          | Auth Method       |
| -------------------- | ----------------- |
| Local dev            | `az login`        |
| Azure App Service    | Managed Identity  |
| Azure Container Apps | Managed Identity  |
| GitHub Actions       | Workload Identity |

No API keys needed - authentication is handled automatically based on your environment.

### Local Development: Required RBAC Role

When running locally, each developer needs the **Azure AI Developer** role on the AI Services resource. Without it, you'll get a `401 PermissionDenied` error with `AIServices/agents/write`.

Ask your project admin to grant it via Azure Portal:

1. Search for your foundry resource
2. Go to **Access control (IAM)** → **+ Add** → **Add role assignment**
3. Select **Azure AI Developer** → assign to the developer's Microsoft account

Or via CLI:

```bash
az role assignment create \
  --assignee "<developer-email>" \
  --role "Azure AI Developer" \
  --scope "<your-ai-services-resource-id>"
```

> **Note:** This is only needed for local development. Deployed environments (AKS, App Service) use Managed Identity with roles assigned automatically via infrastructure-as-code.

> **Important:** After the role is granted, the developer must run `az logout && az login` to refresh their token. RBAC propagation may also take up to 5-10 minutes.

## Architecture

This server implements the **Atomic Pattern** (Responses API):

- **Single API call** handles: conversation creation + user message + AI response
- **No orphan messages** - both user and assistant messages are persisted together
- **Refresh-safe** - if user refreshes mid-request, nothing is saved (clean state)

### Technology Stack

- Express.js 4.x
- TypeScript
- `@azure/ai-projects` - Microsoft Foundry SDK
- `openai` package for API types
- `@azure/identity` for authentication
- CORS with configurable origins

## API Endpoints

### Responses (Primary - Atomic Pattern)

| Method | Endpoint             | Description                              |
| ------ | -------------------- | ---------------------------------------- |
| POST   | `/api/responses`     | **Send message + get response (ATOMIC)** |
| GET    | `/api/responses/:id` | Check response status (rarely needed)    |

### Conversations

| Method | Endpoint                       | Description                             |
| ------ | ------------------------------ | --------------------------------------- |
| GET    | `/api/conversations`           | List all conversations                  |
| GET    | `/api/conversations/:id`       | Get conversation details                |
| PATCH  | `/api/conversations/:id`       | Update conversation (title in metadata) |
| DELETE | `/api/conversations/:id`       | Delete conversation                     |
| GET    | `/api/conversations/:id/items` | List conversation messages              |

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

See the [architecture docs](../docs/src/1-getting-started/architecture.md) for more details on the atomic pattern.

## DataProvider Architecture

Routes consume a **`DataProvider`** interface (`server/providers/types.ts`). The active implementation is selected at runtime by `getProvider()`:

| Provider | Class          | Backing Store                           |
| -------- | -------------- | --------------------------------------- |
| `api`    | `ApiProvider`  | Microsoft Foundry SDK (`openai` package) |
| `mock`   | `MockProvider` | In-memory `mockStore` (no Azure needed) |

```
server/
├── providers/
│   ├── api/               # ApiProvider — wraps OpenAI SDK + session tracking
│   ├── mock/              # MockProvider — wraps in-memory store
│   ├── index.ts           # getProvider() factory (singleton, runtime switch)
│   └── types.ts           # DataProvider interface
├── routes/                # Unified routes — call getProvider(), no SDK imports
│   ├── conversations.route.ts
│   ├── items.route.ts
│   └── responses.route.ts
```

### To Remove Mock Entirely:

1. Delete `/server/providers/mock` folder
2. In `/server/providers/index.ts`:
   - Remove `MockProvider` import and singleton
   - Return `ApiProvider` directly from `getProvider()`
3. Remove `DATASOURCES` from `.env` (defaults to api)
4. Remove admin toggle endpoints if not needed

## CORS

Configured via `CORS_ORIGINS` env var (comma-separated, **required**):

```sh
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

See [deployment guide](../docs/src/3-development/deployment.md) for deploying to Azure via `azd`.
