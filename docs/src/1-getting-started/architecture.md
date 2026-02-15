---
order: 2
---

# Architecture

## Project Structure

```
Edge-Core-Chat/
├── src/                      # Frontend React app
│   ├── components/           # React components
│   │   ├── AppIcon/          # Configurable icon component
│   │   ├── Chat/             # Chat orchestrator (see chat-component.md)
│   │   ├── ChatHistory/      # Conversation history sidebar
│   │   ├── ChatMessage/      # Message rendering
│   │   ├── Disclaimer/       # AI disclaimer
│   │   ├── InputArea/        # Chat input with state management
│   │   ├── MarkdownRenderer/ # Markdown rendering
│   │   ├── Progress/         # Loading indicators
│   │   ├── PromptStarters/   # Prompt suggestions
│   │   └── PageNotFound/     # 404 page
│   ├── config/               # Configuration (see configuration.md)
│   ├── context/              # React contexts (ThemeContext)
│   ├── hooks/                # Custom hooks
│   │   ├── internals/        # Internal hook implementations
│   │   ├── useChatEffects.ts # Auto-scroll, auto-focus
│   │   └── useTheme.ts       # Theme management
│   ├── localization/         # i18n (see localization.md)
│   ├── services/             # Chat API services
│   │   ├── chatApi.ts        # Standard chat service
│   │   ├── streamingChatApi.ts # Streaming chat service
│   │   └── chatApiFactory.ts # Service factory
│   ├── styles/               # Styles (see styling.md)
│   ├── types/                # TypeScript types
│   ├── utils/                # Utility functions
│   ├── routes.tsx            # App routes
│   └── main.tsx              # Entry point
├── server/                   # Reference server implementation (optional)
└── vite.config.ts            # Vite config
```

## System Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────────┐
│   React App     │────▶│   Your Server   │────▶│   Azure AI Foundry  │
│  (Frontend)     │     │ (Responses API) │     │   or OpenAI, etc.   │
│                 │     │                 │     │                     │
└─────────────────┘     └─────────────────┘     └─────────────────────┘
```

The frontend uses **OpenAI Conversations API** types from the `openai` npm package. Your server implements this standard API using the **Atomic Pattern**.

## Atomic Pattern (Responses API)

The architecture follows the **Atomic Pattern** for message handling:

```
User sends "Hello"
       │
       ▼
POST /api/responses { input: "Hello", conversationId? }
       │
       ├── Server creates conversation (if needed)
       ├── Server processes message with AI agent
       ├── Server receives assistant response
       └── Server persists BOTH messages atomically
       │
       ▼
Response: { conversationId, response: { output: [assistant message] } }
```

### Benefits

- **Single API call** - No separate "add message" + "generate response" + "poll status"
- **No orphan messages** - Both user and assistant messages persist together
- **Refresh safe** - If user refreshes mid-request, nothing is saved (clean state)
- **Simple client** - No polling, no status tracking, no complex state

## API Contract

Your server must implement these endpoints:

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/responses` | **Send message + get response (ATOMIC)** |
| GET | `/api/conversations` | List all conversations |
| GET | `/api/conversations/:id` | Get conversation details |
| PATCH | `/api/conversations/:id` | Update conversation (title) |
| DELETE | `/api/conversations/:id` | Delete conversation |
| GET | `/api/conversations/:id/items` | List messages |

### Type Definitions

All types come from `openai` package (Azure AI Foundry uses an OpenAI-compatible client):

```typescript
import type { Conversation, Message } from "openai/resources/conversations/conversations";

// Conversation structure
{
  id: "conv_abc123",
  object: "conversation",
  created_at: 1234567890,
  metadata: {
    title: "My Chat"  // Custom field for UI
  }
}

// Message structure
{
  id: "msg_abc123",
  type: "message",
  role: "user" | "assistant" | "system",
  status: "completed",  // With atomic pattern, always completed
  content: [
    { type: "text", text: "Hello!" }
  ]
}
```

### Request/Response Examples

**Send Message (Atomic):**
```json
POST /api/responses
{
  "input": "Hello!",
  "conversationId": "conv_abc123"  // optional - creates new if not provided
}

→ Returns:
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
        "content": [{ "type": "output_text", "text": "Hi!" }],
        "status": "completed"
      }
    ]
  }
}
```

**Streaming Response:**
```json
POST /api/responses
{ "input": "Tell me a story", "conversationId": "conv_abc123", "stream": true }

→ Returns: SSE stream
data: {"type":"conversation","conversationId":"conv_abc123","isNew":false}
data: {"type":"response.output_text.delta","delta":"Once upon"}
data: {"type":"response.output_text.delta","delta":" a time..."}
data: [DONE]
```

**List Messages:**
```json
GET /api/conversations/conv_abc123/items?order=desc&limit=20

→ Returns: { 
  data: Message[],
  has_more: boolean,
  last_id: string,
  object: "list"
}
```

Pagination parameters:
- `order`: 'asc' | 'desc' (default: 'desc' - newest first)
- `limit`: 1-100 (default: 20)
- `after`: cursor for pagination

## Component Architecture

### Service Pattern

Services are instantiated via factory and consumed by hooks:

```typescript
// chatApiFactory.ts - creates appropriate service
const chatApi = createChatApi(); // Returns ChatApi or StreamingChatApi

// ChatPage.tsx - hook consumes service
const chatProps = useChatConversation({
  api: chatApi,
  initialConversationId,
  onConversationChange: (id) => navigate(id ? `/chat/${id}` : '/chat'),
});

<Chat {...chatProps} />
```

This enables:
- Easy testing with mock handlers
- Swappable backends (standard vs streaming)
- Clean separation of concerns

See [chat-component.md](/2-features/chat-component.md) for Chat component details.

### Provider Hierarchy

```
AppProviders
├── ThemeProvider
└── CopilotProvider (Fluent AI)
    └── AppRoutes
        └── ChatPage
            └── Chat (receives props from useChatConversation hook)
```

Configuration happens at the page/hook level - Chat component is pure presentation.

## Custom Hooks

| Hook | Purpose |
|------|---------|
| `useAutoScroll` | Scroll to bottom on content change |
| `useAutoFocus` | Focus element on mount/state change |
| `useTheme` | Theme state with persistence |
| `useChatConversation` | Chat conversation state management |

### useChatConversation

Main hook for chat functionality, returns all state and handlers for the Chat component:

```typescript
import { useChatConversation } from '@/hooks/useChatConversation';
import { chatApi } from '@/services/chatApi';

const chatProps = useChatConversation({
  api: chatApi,
  initialConversationId: conversationId,
  onConversationChange: (id) => navigate(id ? `/chat/${id}` : '/chat'),
});

// Pass all props to Chat
<Chat {...chatProps} />
```

Internally uses either `_useStandardChatConversation` or `_useStreamingChatConversation` based on API type.

Environment configuration:

```env
# Frontend .env
VITE_API_URL=https://your-server.com       # Production API URL

# Server .env
DATASOURCES=api                            # "api" or "mock"
STREAMING=enabled                          # "enabled" or "disabled"
```

Toggle between mock and API at runtime:
```bash
curl -X POST http://localhost:3001/api/admin/datasource/toggle
```

## Theme System

Priority order:
1. Query param: `?theme=dark`
2. localStorage: `app-theme`
3. System: `prefers-color-scheme`

Values: `light`, `dark`, `system`

## Reference Implementation

A reference Express server is included in `server/`. See [server/README.md](../server/README.md) for details. This is optional - you can implement your own server following the Responses API pattern.

## Type Safety

- **No custom types**: Uses `openai` package types directly
- **Single source of truth**: OpenAI API contract
- **No transformations**: Direct pass-through from API to UI
- **Future-proof**: Automatic updates when OpenAI API evolves

## Patches

Fluent Copilot component fixes via `patch-package`:
- ChatInput overflow and button positioning

Applied automatically on `npm install`.

---

*Last updated: 2026-02-10*
