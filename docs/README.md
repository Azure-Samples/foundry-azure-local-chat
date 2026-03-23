# Foundry Azure Local Chat Documentation

Documentation site for Foundry Azure Local Chat built with [VitePress](https://vitepress.dev/).

## Development

```bash
cd docs
npm install
npm run dev
```

Open http://localhost:5173

## Build

```bash
cd docs
npm run build
npm run preview
```

## Structure

```
docs/
├── .vitepress/
│   └── config.ts          # VitePress configuration
├── src/                   # Markdown documentation files
│   ├── index.md           # Homepage
│   ├── 1-getting-started/ # Setup & architecture
│   ├── 2-features/        # Chat, history, config, styling
│   ├── 3-development/     # Deployment & roadmap
│   └── components/        # Component API docs
├── package.json
└── README.md
```
