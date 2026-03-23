---
order: 2
---

# ChatMessageItem

Renders individual user or assistant messages with markdown support.

> **Source:** `src/components/ChatMessage/ChatMessage.tsx` — exported as `ChatMessageItem`.

## Usage

```tsx
import { ChatMessageItem } from '@/components/ChatMessage/ChatMessage';

<ChatMessageItem
  message={msg}
  avatar={avatarIcon}
  assistantName="Copilot"
/>
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `message` | `Message` | Yes | OpenAI Message object |
| `avatar` | `Slot<"div">` | Yes | Avatar for assistant messages |
| `assistantName` | `string` | No | Display name (default: localized) |

## Behavior

- Extracts text from `text`, `input_text`, or `output_text` content types
- User messages render as `<UserMessage>`
- Assistant messages render as `<CopilotMessage>` with `<MarkdownRenderer>`
- Shows `<StreamingProgress>` when `message.status === "in_progress"`
