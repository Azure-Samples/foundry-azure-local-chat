---
order: 2
---

# Chat History & Conversation Management

## Overview

Edge Core Chat includes built-in conversation management with a sidebar history interface, allowing users to:
- Create new conversations
- View conversation history
- Switch between conversations
- Delete conversations
- Share conversations via URLs (optional)

## Features

### Core Functionality

- **Persistent Conversations**: All conversations are saved and can be resumed later
- **Automatic Titles**: First message becomes the conversation title
- **Real-time Updates**: Sidebar updates as conversations are created/modified
- **Optimistic UI**: Instant feedback while server processes requests
- **Request Cancellation**: Abort in-flight requests when switching conversations
- **Atomic Persistence**: Both user and assistant messages saved together (no orphan messages)

### Optional Features

- **Route-based URLs**: Enable shareable conversation links (`/chat/:conversationId`)
- **Collapsible Sidebar**: Toggle history visibility
- **Disable History**: Can be turned off for single-conversation apps

## Architecture

### Atomic Pattern

Chat history uses the **Atomic Pattern** (Responses API) for message handling:

```
User sends "Hello"
       │
       ▼
POST /api/responses { input: "Hello", conversationId? }
       │
       ├── Server creates conversation (if needed)
       ├── Server processes message with AI agent
       └── Both messages persisted TOGETHER
       │
       ▼
Response: { conversationId, response: { output: [assistant message] } }
```

**Benefits:**
- No orphan messages (user message without response)
- If user refreshes mid-request, nothing is saved (clean state)
- Simple client logic - no polling, no status tracking

### Components

```
ChatPage (routes/ChatPage.tsx)
├── useChatConversation hook (business logic)
└── Chat component (presentation)
    ├── ChatHistory (sidebar)
    └── Chat UI (messages, input)
```

### Data Flow

```
User Action → ChatPage → useChatConversation → chatApi → Server
                ↓
            Chat Component (pure presentation)
```

### Key Principles

1. **Separation of Concerns**: ChatPage orchestrates, Chat renders
2. **No Service Coupling**: All API calls via explicit functions
3. **Single Source of Truth**: Server owns conversation state
4. **Optimistic Updates**: UI updates immediately, syncs with server
5. **Atomic Persistence**: Messages only saved after response completes

## Configuration

### Enable/Disable Features

Edit `src/config/constants.ts`:

```typescript
const CONFIG: TypedConfigOptions = {
  // ...
  "chat.enableHistory": true,    // Show/hide chat history sidebar
  "chat.useRoutes": true,        // Enable URL routing for conversations
  // ...
};
```

- **`chat.enableHistory`**: When `true`, shows sidebar with conversation list. When `false`, single conversation mode.
- **`chat.useRoutes`**: When `true`, conversations use shareable URLs. When `false`, state managed in memory only.

### Routes Configuration

When `"chat.useRoutes": true`:

```
/              → Home (new conversation)
/chat/:id      → Specific conversation
```

When `"chat.useRoutes": false`:
- All conversations stay on `/` route
- State managed in memory only
- URLs don't change when switching conversations

## API Contract

Your backend must implement the **Responses API** (Atomic Pattern):

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/responses` | **Send message + get response (ATOMIC)** |
| GET | `/api/conversations` | List conversations |
| GET | `/api/conversations/:id` | Get conversation details |
| PATCH | `/api/conversations/:id` | Update conversation (title) |
| DELETE | `/api/conversations/:id` | Delete conversation |
| GET | `/api/conversations/:id/items` | List conversation messages |

### Responses Endpoint (Atomic)

```json
POST /api/responses
{
  "input": "Hello!",
  "conversationId": "conv_abc123",  // optional - creates new if not provided
  "stream": false
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

### Items Endpoint

```json
GET /api/conversations/conv_abc123/items?order=desc&limit=20

{
  "data": [...],           // Message[] (only messages, not tool calls)
  "has_more": false,
  "last_id": "msg_xyz",
  "object": "list"
}
```

Pagination parameters:
- `order`: 'asc' | 'desc' (default: 'desc')
- `limit`: 1-100 (default: 20)
- `after`: cursor for next page

See [architecture.md](/1-getting-started/architecture.md#api-contract) for full endpoint details.

## Backend Requirements

Chat history requires a backend server. The included Azure AI Foundry server (`server/`) provides a reference implementation.

**Required Environment Variables** (in `server/.env`):

```bash
AZURE_AI_PROJECT_CONNECTION_STRING=your-connection-string
AZURE_AI_AGENT_ID=your-agent-id
```

See [Server Setup](../server/README.md) for full configuration guide.

## Usage Examples

### Basic Usage (No Routes)

```typescript
// App.tsx
import { ChatPage } from "./routes/ChatPage";

function App() {
  return <ChatPage />;
}
```

### With React Router

```typescript
// App.tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ChatPage } from "./routes/ChatPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ChatPage />} />
        <Route path="/chat/:conversationId" element={<ChatPage />} />
      </Routes>
    </BrowserRouter>
  );
}
```

### Custom Backend Integration

```typescript
// services/chatApi.ts
export const chatApi = {
  async sendMessage(message: string) {
    const res = await fetch("/your-api/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        input: message, 
        conversationId: this.currentConversationId 
      })
    });
    const data = await res.json();
    this.currentConversationId = data.conversationId;
    return data.response.output[0]; // assistant message
  },
  
  async fetchConversations() {
    const res = await fetch("/your-api/conversations");
    return res.json();
  },
  
  async fetchMessages(conversationId: string) {
    const res = await fetch(`/your-api/conversations/${conversationId}/items`);
    const data = await res.json();
    return { 
      messages: data.data.reverse(),  // API returns newest first
      hasInProgress: false            // Atomic pattern - always false
    };
  },
  
  // ... implement other methods per API contract
};
```

## Request Handling

### Refresh Mid-Request (Atomic Pattern)

With the atomic pattern, refresh handling is simple:

| Scenario | What Happens | User Experience |
|----------|--------------|-----------------|
| User sends message | Request in-flight, nothing persisted | Shows loading |
| User refreshes | Request aborted, nothing saved | Clean conversation |
| Page reloads | Fetch items shows only completed exchanges | Normal state |

**No orphan messages, no polling needed.**

### Optimistic Updates

New conversations appear immediately in sidebar:

1. User sends message
2. Temporary conversation created instantly (UI updates)
3. Server processes request atomically
4. Temp conversation replaced with real ID + title

### Efficient Fetching

- Single conversation endpoint (`GET /api/conversations/:id`) avoids fetching full list
- Messages fetched only when conversation is selected
- Sidebar shows title/metadata only (no full message history)

## UI Components

### ChatHistory (Sidebar)

Uses the FluentAI Navigation component from `@fluentui-copilot/react-nav`:

```tsx
import { Nav, NavCategory, NavCategoryItem, NavSubItem } from "@fluentui-copilot/react-nav";

<Nav>
  <NavCategory value="chats">
    <NavCategoryItem>Chats</NavCategoryItem>
    {conversations.map(conv => (
      <ChatSubItem key={conv.id} conversation={conv} />
    ))}
  </NavCategory>
</Nav>
```

**Features:**
- Collapsible categories
- Active item highlighting
- Hover actions (rename, delete)
- Auto-focus on new chat

### ChatSubItem Component

Individual conversation item in the sidebar:

```tsx
<ChatSubItem
  conversation={conv}
  isActive={conv.id === activeId}
  onSelect={() => selectConversation(conv.id)}
  onDelete={() => deleteConversation(conv.id)}
  onRename={(newTitle) => renameConversation(conv.id, newTitle)}
/>
```

**Features:**
- Single-line title with ellipsis
- Hover reveals action buttons
- Inline rename editing
- Delete confirmation

### App Icons

Configure the icons shown in sidebar header and new chat button:

```typescript
// src/config/constants.ts
const CONFIG: TypedConfigOptions = {
  // ...
  "sidebar.showIcon": true,
  "sidebar.icon": "/my-app-icon.svg",
  "newChat.showIcon": true,
  "newChat.icon": "/new-chat-icon.svg",
  // ...
};
```

See [Styling Guide](./styling.md) for theming options.

## Troubleshooting

### Conversations Not Persisting

- Check server `/api/responses` endpoint is implemented correctly
- Verify `conversationId` is returned in response
- Check browser console for API errors

### Sidebar Not Updating

- Ensure server returns updated conversation list
- Check `onConversationChange` callback is wired correctly
- Verify no React strict mode double-render issues

### Messages Showing in Wrong Order

- Server must return messages sorted by timestamp (newest first)
- Client reverses for display (oldest at top)
- Check message timestamps are correctly set

### Route URLs Not Working

- Verify `"chat.useRoutes": true` in `src/config/constants.ts`
- Ensure React Router is configured with `/chat/:conversationId` route in `src/routes.tsx`
- Check `onConversationChange` callback is provided to `useChatConversation` hook

## Best Practices

1. **Use atomic pattern**: Single `/api/responses` call handles everything
2. **Server owns titles**: Don't calculate titles on client, fetch from server
3. **Abort on navigation**: Clean up requests when users navigate away
4. **Optimistic UI**: Show immediate feedback, sync with server in background
5. **Error handling**: Show user-friendly errors when API calls fail
6. **No polling**: With atomic pattern, no need to poll for status

## Future Enhancements

- Conversation search/filter
- Conversation folders/categories
- Export conversation history
- Conversation sharing (read-only links)
- Message editing/regeneration
- Conversation templates

---
*Last updated: 2026-02-10*
