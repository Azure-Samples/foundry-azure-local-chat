---
order: 6
---

# Progress Components

Loading and streaming progress indicators.

## LoadingMessage

Shows morse code animation in a CopilotMessage loading state.

```tsx
<LoadingMessage avatar={avatarIcon} />
```

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `avatar` | `Slot<"div">` | Yes | Avatar element |

## StreamingProgress

Morse code animation shown beneath streaming message content.

```tsx
<StreamingProgress />
```

No props - renders inline morse code animation.
