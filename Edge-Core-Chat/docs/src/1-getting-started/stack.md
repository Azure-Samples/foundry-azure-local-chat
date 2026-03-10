---
order: 3
---

# Technology Stack

## Core Framework

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.x | UI library |
| TypeScript | 5.8 | Type-safe JavaScript |
| Vite | 7.x | Build tool and dev server |

## UI Components

### Microsoft Fluent UI

| Package | Description |
|---------|-------------|
| `@fluentui/react-components` | Fluent UI v9 component library |
| `@fluentui/react-icons` | Fluent UI icon set |

### Fluent AI Copilot Components

| Package | Components Provided |
|---------|---------------------|
| `@fluentui-copilot/react-copilot` | CopilotProvider, CopilotChat |
| `@fluentui-copilot/react-copilot-chat` | CopilotMessage, UserMessage |
| `@fluentui-copilot/react-chat-input` | ChatInput with send/stop |
| `@fluentui-copilot/react-copilot-nav` | Nav, NavCategory, NavSubItem |
| `@fluentui-copilot/react-morse-code` | MorseCodeLoader |
| `@fluentui-copilot/react-prompt-starter` | PromptStarterV2, PromptStarterList |

## Markdown Rendering

| Package | Purpose |
|---------|---------|
| `react-markdown` | Core markdown renderer |
| `react-syntax-highlighter` | Code syntax highlighting (Prism) |
| `remark-gfm` | GitHub Flavored Markdown (tables, strikethrough, task lists) |
| `remark-math` | Math syntax parsing |
| `rehype-katex` + `katex` | Math rendering (LaTeX) |
| `rehype-raw` | HTML in markdown |

## API Types

| Package | Version | Purpose |
|---------|---------|---------|
| `openai` | ^6.18.0 | Type definitions for Conversation, Message, Response (dev dependency) |

## Routing

| Package | Version | Purpose |
|---------|---------|---------|
| react-router-dom | 7.x | Client-side routing |

## Styling

| Technology | Purpose |
|------------|---------|
| Griffel | Fluent UI's CSS-in-JS solution (makeStyles) |
| CSS Custom Properties | Theme tokens from Fluent |

## Development Tools

| Tool | Purpose |
|------|---------|
| ESLint 9 | Linting with TypeScript support |
| eslint-plugin-simple-import-sort | Automatic import sorting |
| eslint-plugin-jsx-a11y | Accessibility linting |
| vite-plugin-html | HTML template injection |
| vite-plugin-checker | ESLint/TypeScript overlay in browser |
| patch-package | Runtime patches for dependencies |
| EditorConfig | Consistent formatting across editors |

## Path Aliases

```typescript
// tsconfig.json paths - single alias resolves all subpaths
"@/*" → "src/*"
```

Usage: `import { config } from "@/config/constants"` resolves to `src/config/constants`.

## Import Order Convention

ESLint enforces this import order:
1. React imports (`react`, `react-dom`)
2. Fluent UI imports (`@fluentui/*`, `@fluentui-copilot/*`)
3. Third-party packages
4. Local imports (`@/...`)

## Build Outputs

| Command | Output |
|---------|--------|
| `npm run build` | Standard build in `/dist` |
| `npm run build:static` | Static build with relative paths |

---
*Last updated: 2026-02-19*
