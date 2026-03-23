---
order: 9
---

# ChatHistory

Sidebar component for conversation history. Uses `@fluentui-copilot/react-copilot-nav` for the navigation drawer.

## Usage

```tsx
import { ChatHistory } from "@/components/ChatHistory/ChatHistory";

<ChatHistory
  conversations={conversations}
  activeConversationId={activeConversation?.id}
  onNewChat={handleNewChat}
  onSelectConversation={handleSelectConversation}
  onDeleteConversation={handleDeleteConversation}
  onRenameConversation={handleRenameConversation}
/>;
```

## Props

| Prop                   | Type                                           | Required | Description                     |
| ---------------------- | ---------------------------------------------- | -------- | ------------------------------- |
| `conversations`        | `ChatConversation[]`                           | Yes      | Conversation list               |
| `activeConversationId` | `string \| undefined`                          | No       | Currently selected conversation |
| `onNewChat`            | `() => void`                                   | Yes      | New conversation handler        |
| `onSelectConversation` | `(id: string) => void`                         | Yes      | Select conversation handler     |
| `onDeleteConversation` | `(id: string) => Promise<void>`                | Yes      | Delete handler                  |
| `onRenameConversation` | `(id: string, title: string) => Promise<void>` | Yes      | Rename handler                  |

## Behavior

- **Self-managing**: Owns its own open/closed state internally (toggle button rendered inside the component)
- Renders as a collapsible drawer using `CopilotNav`
- Animation delay logic lives inside ChatHistory
- Shows recent conversations (5) and an expandable "All conversations" section
- Active conversation is highlighted
- Each item rendered as `ChatSubItem` with context menu (rename, delete)
- Inline rename editing with confirmation

## Configuration

```typescript
"chat.enableHistory": true,  // Show/hide the sidebar entirely
```

See [Chat History feature guide](/2-guide/chat-history) for architecture and configuration details.
