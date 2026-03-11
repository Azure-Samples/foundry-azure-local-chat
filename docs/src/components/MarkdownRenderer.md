---
order: 5
---

# MarkdownRenderer

Renders markdown content with syntax highlighting.

## Usage

```tsx
<MarkdownRenderer content={markdownText} />
<MarkdownRenderer content={streamingText} isStreaming />
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `content` | `string` | Yes | Markdown content |
| `className` | `string` | No | Additional CSS class |
| `isStreaming` | `boolean` | No | Optimizes for streaming (disables syntax highlighting) |

## Features

- GFM (GitHub Flavored Markdown) support via `remark-gfm`
- Syntax highlighting via `rehype-highlight` (disabled during streaming)
- Styled tables, code blocks, blockquotes
- Memoized to reduce re-renders
