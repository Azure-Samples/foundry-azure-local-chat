---
order: 8
---

# Chat

The main chat UI component. Renders the full conversation interface including messages, input area, and sidebar toggle. It is **presentation-only** - all state and handlers are received via props.

## Usage

```tsx
import { Chat } from "@/components/Chat/Chat";

<Chat
  activeConversation={activeConversation}
  messages={messages}
  isInitializing={isInitializing}
  isLoading={isLoading}
  handleSendMessage={handleSendMessage}
  handleStop={handleStop}
/>;
```

Typically used in `ChatPage` where props come from the `useChatConversation` hook:

```tsx
const { state, handlers } = useChatConversation({
  api: chatApi,
  initialConversationId,
});

<Chat
  activeConversation={state.activeConversation}
  messages={state.messages}
  isInitializing={state.isInitializing}
  isLoading={state.isLoading}
  handleSendMessage={handlers.handleSendMessage}
  handleStop={handlers.handleStop}
/>;
```

## Props

Accepts `ChatState & ChatHandlers` - the conversation-focused subset of the chat hook's return type.

### State

| Prop                 | Type                       | Description                      |
| -------------------- | -------------------------- | -------------------------------- |
| `activeConversation` | `ChatConversation \| null` | Currently active conversation    |
| `messages`           | `ChatMessage[]`            | Messages in active conversation  |
| `isInitializing`     | `boolean`                  | Initial load state               |
| `isLoading`          | `boolean`                  | Message send/receive in progress |

### Handlers

| Prop                | Type                              | Description           |
| ------------------- | --------------------------------- | --------------------- |
| `handleSendMessage` | `(text: string) => Promise<void>` | Send a message        |
| `handleStop`        | `() => void`                      | Abort current request |

## Behavior

### Welcome Screen (no messages)

- Centered welcome title and input
- Prompt starters (when `config.isEnabled("chat.showPromptStarters")`)

### Conversation View (has messages)

- Scrollable message list with auto-scroll
- User messages (right-aligned) and assistant messages (with avatar + markdown)
- Input fixed at bottom with AI disclaimer
- Loading: input disabled, send becomes stop, morse code animation

### Sub-Components

Internally renders: [ChatMessageItem](/components/ChatMessage), [InputArea](/components/InputArea), [PromptStarters](/components/PromptStarters), [Progress](/components/Progress), [Disclaimer](/components/Disclaimer).

Note: [ChatHistory](/components/ChatHistory) is now a sibling component rendered by ChatPage, not a child of Chat.

See [Chat Component feature guide](/2-features/chat-component) for detailed behavior.
