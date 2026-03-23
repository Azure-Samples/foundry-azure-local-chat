---
order: 1
---

# Chat Component

The Chat component is the pure conversation UI for displaying the current chat.

## Overview

The Chat component is **UI-only** and **conversation-focused** - it receives only the state and handlers needed for the current conversation. ChatHistory is now handled by ChatPage as a sibling component.

## Usage

```tsx
import { Chat } from "@/components/Chat/Chat";
import { useChatConversation } from "@/hooks/useChatConversation";
import { chatApi } from "@/services/chatApi";

function ChatPage() {
  const { state, handlers } = useChatConversation({
    api: chatApi,
    initialConversationId: conversationId,
  });

  return (
    <Chat
      activeConversation={state.activeConversation}
      messages={state.messages}
      isInitializing={state.isInitializing}
      isLoading={state.isLoading}
      handleSendMessage={handlers.handleSendMessage}
      handleStop={handlers.handleStop}
    />
  );
}
```

## Props

The Chat component accepts `ChatState & ChatHandlers` - the conversation-focused subset of the hook's return type:

### State Props

| Prop                 | Type                       | Description                              |
| -------------------- | -------------------------- | ---------------------------------------- |
| `activeConversation` | `ChatConversation \| null` | Currently active conversation            |
| `messages`           | `ChatMessage[]`            | Messages in the active conversation      |
| `isInitializing`     | `boolean`                  | Whether the chat is initializing         |
| `isLoading`          | `boolean`                  | Whether a message is being sent/received |

### Handler Props

| Prop                | Type                              | Description              |
| ------------------- | --------------------------------- | ------------------------ |
| `handleSendMessage` | `(text: string) => Promise<void>` | Send a message           |
| `handleStop`        | `() => void`                      | Stop the current request |

**Note:** Types are defined in `@/types/chat.types`. History-related props (conversations, etc.) are handled by ChatHistory, which is a self-managing sibling component rendered by ChatPage.

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

See the [Components](/components/) section for individual component documentation, and [architecture.md](/1-getting-started/architecture.md#component-architecture) for how Chat fits into the overall component hierarchy.
