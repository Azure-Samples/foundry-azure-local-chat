---
order: 4
---

# InputArea

Self-contained chat input with managed state.

## Usage

```tsx
const inputRef = React.useRef<InputAreaRef>(null);

<InputArea
  ref={inputRef}
  isLoading={false}
  onSubmit={(text) => sendMessage(text)}
  onStop={() => cancelRequest()}
/>

// Focus programmatically
inputRef.current?.focus();
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `isLoading` | `boolean` | Yes | Request in progress |
| `isWelcome` | `boolean` | No | Welcome screen styling variant |
| `onSubmit` | `(text: string) => void` | Yes | Called with trimmed text on submit |
| `onStop` | `() => void` | Yes | Called when stop button clicked |

## Ref Methods

| Method | Description |
|--------|-------------|
| `focus()` | Focus the textarea input |
