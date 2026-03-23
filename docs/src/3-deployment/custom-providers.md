---
order: 2
---

# Custom Providers Guide

This guide explains how to use a different API (e.g., Chat Completions, Agents), or how to reuse the chat UI with a completely different backend.

## Architecture Overview

The application is split into two independently pluggable layers:

```
┌─────────────────────────────────────────────────────┐
│  Chat UI (React)                                    │
│  Talks to the backend through a service interface   │
│  ↕                                                  │
│  Frontend Service Interface                         │
│  (fetchConversations, sendMessage, …)               │
├─────────────────────────────────────────────────────┤
│  Express Server                                     │
│  Routes call the active provider — never a          │
│  concrete implementation directly                   │
│  ↕                                                  │
│  Server Provider Interface                          │
│  (listConversations, createResponse, …)             │
├──────────────────┬──────────────────────────────────┤
│  MS Foundry      │  Mock Provider  │  Your Provider │
│  (ApiProvider)   │  (MockProvider) │  (you add)     │
└──────────────────┴──────────────────────────────────┘
```

**Key idea:** Both the server and the UI communicate through interfaces, not concrete implementations. This means you can swap or add providers on either side without touching the other.

---

## Option 1 — Bring Your Own Server

Use this approach when you want to replace the included Express server entirely and point the chat UI at your own backend.

The UI never calls the server directly — it communicates through a **service interface** defined in `src/types/chat.types.ts`. Your server just needs to implement the [API contract](/1-getting-started/architecture.md#api-contract).

Point the UI at your server by setting the `VITE_API_URL` environment variable:

```bash
VITE_API_URL=https://my-server.example.com/api npm run dev
```

No frontend code changes required — the UI will work with any server that matches this contract.

---

## Option 2 — Add a Custom API Provider

Use this approach when you want to keep the existing Express server and chat UI but connect to a different API (e.g., Chat Completions, Agents, or your own custom API).

### Step 1: Implement the provider interface

Create a new folder under `server/providers/` for your provider. Your class must implement the `DataProvider` interface defined in `server/providers/types.ts`.

The interface requires these methods:

| Method                 | Purpose                                      |
| ---------------------- | -------------------------------------------- |
| `listConversations`    | Return all conversations for a session       |
| `getConversation`      | Return a single conversation by ID           |
| `createConversation`   | Create a new conversation                    |
| `updateConversation`   | Update conversation metadata (e.g., rename)  |
| `deleteConversation`   | Delete a conversation                        |
| `listConversationItems`| Return paginated messages for a conversation |
| `createResponse`       | Send a user message and generate an AI reply |

Example skeleton:

```typescript
// server/providers/custom/CustomProvider.ts

import type {
  DataProvider,
  Conversation,
  CreateConversationParams,
  CreateResponseParams,
  CreateResponseResult,
  DeleteConversationResult,
  ListConversationItemsParams,
  ListConversationItemsResult,
} from "../types";

export class CustomProvider implements DataProvider {
  async listConversations(sessionId: string): Promise<Conversation[]> {
    // Call your API endpoint
  }

  async getConversation(conversationId: string): Promise<Conversation | null> {
    // ...
  }

  async createConversation(params: CreateConversationParams): Promise<Conversation> {
    // ...
  }

  async updateConversation(
    conversationId: string,
    metadata: Record<string, string>,
  ): Promise<Conversation | null> {
    // ...
  }

  async deleteConversation(
    conversationId: string,
    sessionId: string,
  ): Promise<DeleteConversationResult> {
    // ...
  }

  async listConversationItems(
    params: ListConversationItemsParams,
  ): Promise<ListConversationItemsResult> {
    // ...
  }

  async createResponse(params: CreateResponseParams): Promise<CreateResponseResult> {
    // This is where you call your API.
    // Return the AI-generated response in the expected format.
    // For streaming, return a `stream` async iterable instead of `response`.
  }
}
```

### Step 2: Register your provider in the factory

Open `server/providers/index.ts` and add your provider alongside the existing ones:

```typescript
import { CustomProvider } from "./custom/CustomProvider";

let customProvider: CustomProvider | null = null;

export const getProvider = (): DataProvider => {
  const source = config.getDatasource();

  if (source === "custom") {
    if (!customProvider) {
      customProvider = new CustomProvider();
    }
    return customProvider;
  }

  // ... existing mock/api logic
};
```

### Step 3: Add the new datasource option

In `server/utils/datasources.ts`, extend the `DataSource` type to include your new option:

```typescript
export type DataSource = "mock" | "api" | "custom";
```

Then set it in `server/.env`:

```bash
# server/.env
DATASOURCES=custom
```

Restart the server and that's it — all existing routes, streaming logic, and the chat UI will automatically use your provider.

---

## Option 3 — Swap the Frontend API Layer

Use this approach when you want to replace how the UI communicates with the backend — for example, to point it at a different server or change the API contract entirely.

The chat UI receives its data through a **service interface** (`BaseChatApi` in `src/types/chat.types.ts`). You can create a new implementation of this interface and swap it in with no component changes.

### Step 1: Create a service implementation

Create a new file that implements the `BaseChatApi` interface, pointing at your backend:

```typescript
// src/services/myBackendApi.ts

import type { BaseChatApi, ChatConversation, SendMessageOptions, SendMessageResult } from "@/types/chat.types";
import type { Message } from "@/types/api.types";

const BASE_URL = "https://my-backend.example.com/api";

export const myBackendApi: BaseChatApi = {
  fetchConversations: async (): Promise<ChatConversation[]> => {
    const res = await fetch(`${BASE_URL}/conversations`);
    return res.json();
  },

  sendMessage: async (options: SendMessageOptions): Promise<SendMessageResult> => {
    const res = await fetch(`${BASE_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options),
    });
    return res.json();
  },

  fetchMessages: async (conversationId: string, options?: { limit?: number; after?: string }) => {
    const params = new URLSearchParams();
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.after) params.set("after", options.after);

    const res = await fetch(`${BASE_URL}/conversations/${conversationId}/messages?${params}`);
    return res.json();
  },

  // ... implement the remaining methods
};
```

### Step 2: Wire it into the chat module factory

Open `src/services/chatApiFactory.ts` and update `loadChatModule` to return your service:

```typescript
import { myBackendApi } from "./myBackendApi";

export const loadChatModule = async (): Promise<ChatModule> => {
  const { useStandardChatConversation } = await import(
    "@/hooks/internals/_useStandardChatConversation"
  );

  return {
    api: myBackendApi,
    useChatConversation: useStandardChatConversation,
    settings: { streaming: false },
  };
};
```

If your backend supports streaming, implement the `StreamingChatApi` interface instead and pair it with `useStreamingChatConversation`.

No UI components need to change — they receive the service through props and hooks.

---

## Key Files Reference

| File                                | Purpose                                          |
| ----------------------------------- | ------------------------------------------------ |
| `server/providers/types.ts`         | `DataProvider` interface (server-side contract)   |
| `server/providers/index.ts`         | Provider factory — returns the active provider    |
| `server/utils/datasources.ts`       | Runtime datasource config and toggling            |
| `src/types/chat.types.ts`           | `BaseChatApi` interface (frontend service contract) |
| `src/services/chatApiFactory.ts`    | Frontend module factory — loads the active service |
| `src/services/chatApi.ts`           | Standard (REST) service implementation            |
| `src/services/streamingChatApi.ts`  | Streaming (SSE) service implementation            |

