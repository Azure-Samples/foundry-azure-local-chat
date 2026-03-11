---
order: 7
---

# PromptStarters

Displays prompt suggestion cards.

## Usage

```tsx
<PromptStarters onPromptClick={(prompt) => sendMessage(prompt)} />
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `onPromptClick` | `(prompt: string) => void` | Yes | Called when user clicks a prompt |
| `starters` | `PromptStarter[]` | No | Custom starters (default: `PROMPT_STARTERS`) |
| `visibleRows` | `number` | No | Rows before collapse (default: config) |
| `expandLabel` | `string` | No | "Show more" text |
| `collapseLabel` | `string` | No | "Show less" text |
| `ariaLabel` | `string` | No | List ARIA label |
| `getAriaLabel` | `(prompt: string) => string` | No | Per-item ARIA label |

## PromptStarter Type

```ts
interface PromptStarter {
  id: string;
  prompt: string;
  category: string;
}
```
