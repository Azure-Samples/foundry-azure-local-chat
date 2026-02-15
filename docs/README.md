# Edge Core Chat Documentation

Documentation site for Edge Core Chat built with [VitePress](https://vitepress.dev/).

## Development

```bash
cd docs
npm install
npm run dev
```

Open http://localhost:5173

## Build

```bash
npm run build
npm run preview
```

## Structure

```
docs/
├── .vitepress/
│   └── config.ts      # VitePress configuration
├── src/               # Markdown documentation files
│   ├── index.md       # Homepage
│   ├── getting-started.md
│   ├── architecture.md
│   └── ...
├── package.json
└── README.md
```
