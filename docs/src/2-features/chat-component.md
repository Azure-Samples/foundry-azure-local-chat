---
order: 1
---

# Chat Component

The Chat component is the main UI for conversational experiences.

## Overview

The Chat component is **UI-only** - it receives all state and handlers via props. This allows integration with any backend service.

## Usage

```tsx
import { Chat } from '@/components/Chat/Chat';
import { useChatConversation } from '@/hooks/useChatConversation';
import { chatApi } from '@/services/chatApi';

function ChatPage() {
  const chatProps = useChatConversation({
    api: chatApi,
    initialConversationId: conversationId,
    onConversationChange: (id) => navigate(id ? `/chat/${id}` : '/chat'),
  });
  
  return <Chat {...chatProps} />;
}
```

## Props

The Chat component accepts `UseChatConversationReturn` which combines state and handlers:

### State Props

| Prop | Type | Description |
|------|------|-------------|
| `conversations` | `ChatConversation[]` | List of all conversations for history sidebar |
| `activeConversation` | `ChatConversation \| null` | Currently active conversation |
| `messages` | `ChatMessage[]` | Messages in the active conversation |
| `isHistoryOpen` | `boolean` | Whether the chat history sidebar is open |
| `isInitializing` | `boolean` | Whether the chat is initializing |
| `isLoading` | `boolean` | Whether a message is being sent/received |

### Handler Props

| Prop | Type | Description |
|------|------|-------------|
| `onHistoryOpenChange` | `(open: boolean) => void` | Toggle chat history sidebar |
| `handleNewChat` | `() => void` | Start a new conversation |
| `handleSelectConversation` | `(id: string) => void` | Switch to a different conversation |
| `handleDeleteConversation` | `(id: string) => Promise<void>` | Delete a conversation |
| `handleRenameConversation` | `(id: string, newTitle: string) => Promise<void>` | Rename a conversation |
| `handleSendMessage` | `(text: string) => Promise<void>` | Send a message |
| `handleStop` | `() => void` | Stop the current request |

**Note:** Types are defined in `@/types/chat.types`.

## Features

### Welcome Screen

When there are no messages:
- Welcome title
- Chat input centered on screen
- Prompt starters (configurable via `config.isEnabled("chat.showPromptStarters")`)

### Conversation View

When messages exist:
- Scrollable message list with auto-scroll
- User messages (right-aligned)
- Assistant messages (with avatar and markdown)
- Chat input fixed at bottom
- AI disclaimer footer

### Loading & Stop

- Input disabled while loading
- Send button becomes Stop button
- Morse code animation shows progress
- Stop aborts request and removes pending message

## Configuration

```ts
"chat.showPromptStarters": true,
"chat.promptStarterVisibleRows": 1,
```

See [configuration.md](./configuration.md) for all options.

## Sub-Components

See the [Components](/components/) section for individual component documentation.

---

*Last updated: 2026-02-10*
