---
order: 0
---

# Zero to Hero

A guided path through the repo - from first run to production deployment.

## 1. Understand What This Is

foundry-azure-local-chat is a **pluggable chat UI** that connects to any backend implementing the OpenAI Conversations API. It ships with a reference server (Express + Microsoft Foundry) but you can bring your own.

```
Frontend (React + Fluent UI)  ←→  Any Backend  ←→  Any AI
```

**Read:** [Architecture Overview](./architecture.md) - system diagram, API contract, pluggable provider pattern

## 2. Run It Locally

```bash
git clone https://your-repo-url
cd foundry-azure-local-chat
npm install
npm run dev          # frontend at http://localhost:5173 (mock mode)
```

Want the reference server too?

```bash
cp server/.env.example server/.env
cd server && npm install && npm run dev   # backend at http://localhost:3001
```

**Read:** [Getting Started](./getting-started.md) - prerequisites, mock mode, dev overlay

## 3. Explore the Code

<LiteTree>
---
- foundry-azure-local-chat/
    + src/                          // Frontend React app
        + components/               // Chat, ChatHistory, InputArea
        + hooks/                    // useChatConversation, useStreaming
        + services/                 // chatApi.ts, chatApiFactory.ts
        + types/                    // OpenAI-aligned types
        + config/                   // App configuration
        + localization/             // i18n strings
        + styles/                   // Theme system (light/dark)
        routes.tsx
        main.tsx
    + server/                       // Reference Express server
        + routes/                   // Express API routes
        + services/                 // Microsoft Foundry SDK
        + providers/                // DataProvider (Mock + API)
        + middleware/               // CORS, error handling
        index.ts
        Dockerfile
        .env.example
    + infra/                        // Azure infrastructure (Bicep + K8s)
        + modules/                  // Bicep (AKS, ACR, Identity, RBAC, MS Foundry)
        + modes/
            + k8s/                  // K8s manifests + deploy script
            + containerapp/         // Container Apps deploy + WI watcher
        naming.sh
        main.bicep
        main.parameters.json
    + hooks/                        // azd lifecycle hooks
        preprovision.sh
        postprovision.sh
        deploy.sh
    + scripts/                      // Dev utilities
    + docs/                         // VitePress documentation
    azure.yaml                      // azd project config
    vite.config.ts
    package.json
</LiteTree>

**Read in this order:**

1. [Services](../2-features/services.md) - how client API + server DataProvider work (the core)
2. [Hooks](../2-features/hooks.md) - React hooks that components consume
3. [Chat Component](../2-features/chat-component.md) - the main UI
4. [Types](../2-features/types.md) - type reference

## 4. Configure It

Two levels of config:

| What     | Where                              | Examples                                   |
| -------- | ---------------------------------- | ------------------------------------------ |
| Frontend | `.env` / `src/config/constants.ts` | `VITE_API_URL`, theme, layout              |
| Server   | `server/.env`                      | `DATASOURCES`, `STREAMING`, AI credentials |

**Read:** [Configuration](../2-features/configuration.md) - all options with examples

## 5. Customize It

**Swap the backend:**

```sh
VITE_API_URL=https://your-backend.com/api
```

Your backend just needs to implement `POST /api/responses`. See the [API contract](./architecture.md#api-contract).

**Change the look:**

- Theme: `?theme=dark` or `localStorage`
- Styles: `src/styles/` - CSS variables, Fluent UI tokens
- Strings: `src/localization/en.ts`

**Read:** [Styling](../2-features/styling.md) · [Localization](../2-features/localization.md)

## 6. Deploy to Azure

Two modes - pick one:

|         | K8s         | Container Apps |
| ------- | ----------- | -------------- |
| HTTPS   | Self-signed | Free auto TLS  |
| Regions | Any         | 11 only        |
| Cost    | ~$140/mo    | ~$280/mo       |

The fastest way is with a recipe - it sets all defaults for you:

```bash
azd env set RECIPE all    # full stack + MS Foundry
azd up                    # prompts for subscription + location, recipe handles the rest
```

> **Note:** `ARC_PREFIX` is auto-derived from the azd environment name. `azd env new my-chat` creates `my-chat-rg`, `my-chat-cluster`, etc.

Available recipes:

| Recipe | What you get                                                   |
| ------ | -------------------------------------------------------------- |
| `all`  | Full stack + MS Foundry (gpt-4o-mini, D2s_v3, 2 nodes)         |
| `dev`  | Full stack + mock AI (B2s cheapest VM, admin enabled, CORS=\*) |

Or run `azd up` without `RECIPE` for the interactive wizard (arrow-key navigation for region, VM size, AI mode, deploy scope, etc.).

For CI/automation:

```bash
azd env new my-chat
azd env set RECIPE all
azd up -- -y
```

Or deploy frontend only (BYOB):

```bash
azd env set DEPLOY_SCOPE "frontend"
azd env set VITE_API_URL "https://your-backend.com/api"
azd up
```

**Read:** [Deployment](../3-development/deployment.md) - full guide with cookbooks for every scenario

## 7. Contribute

```bash
npm run lint         # check code
npm run typecheck    # check types
npm run build        # production build
```

**Read:** [Plan](../4-status/plan.md) · [Action Items](../4-status/action-items-plan.md)

## Quick Reference

| I want to...         | Do this                                                  |
| -------------------- | -------------------------------------------------------- |
| Run frontend only    | `npm run dev`                                            |
| Run with server      | `npm run dev` + `cd server && npm run dev`               |
| Use mock data        | `DATASOURCES=mock` in `server/.env`                      |
| Use MS Foundry       | `DATASOURCES=api` + set `AI_PROJECT_ENDPOINT`            |
| Deploy full stack    | `azd env set RECIPE all && azd up`                       |
| Deploy frontend only | `azd env set DEPLOY_SCOPE "frontend"` + `azd up`         |
| Change theme         | `?theme=dark` in URL                                     |
| Toggle streaming     | `curl -X POST localhost:3001/api/admin/streaming/toggle` |
| Bring my own backend | Set `VITE_API_URL` in `.env`                             |

## Learning Path

Read the docs in this order for a complete understanding:

| #   | Doc                                               | What you'll learn                               | Time   |
| --- | ------------------------------------------------- | ----------------------------------------------- | ------ |
| 1   | [Zero to Hero](./zero-to-hero.md)                 | This guide - the big picture                    | 5 min  |
| 2   | [Getting Started](./getting-started.md)           | Install, run, dev workflow                      | 5 min  |
| 3   | [Architecture](./architecture.md)                 | System design, API contract, provider pattern   | 10 min |
| 4   | [Services](../2-features/services.md)             | Client chatApi + server DataProvider - the core | 10 min |
| 5   | [Hooks](../2-features/hooks.md)                   | React hooks API reference                       | 5 min  |
| 6   | [Chat Component](../2-features/chat-component.md) | Main chat UI props and usage                    | 5 min  |
| 7   | [Chat History](../2-features/chat-history.md)     | Sidebar, conversation management                | 5 min  |
| 8   | [Configuration](../2-features/configuration.md)   | All config options (frontend + server)          | 5 min  |
| 9   | [Types](../2-features/types.md)                   | TypeScript type reference                       | 5 min  |
| 10  | [Styling](../2-features/styling.md)               | Theme system, CSS customization                 | 5 min  |
| 11  | [Localization](../2-features/localization.md)     | i18n setup, adding languages                    | 5 min  |
| 12  | [Stack](./stack.md)                               | Dependencies, tools, versions                   | 3 min  |
| 13  | [Deployment](../3-development/deployment.md)      | Azure deploy (azd), modes, BYOB, cookbooks      | 15 min |
| 14  | [Plan](../4-status/plan.md)                       | Roadmap, phases, status                         | 3 min  |

**Shortcut paths:**

- **"I just want to run it"** → #1, #2
- **"I want to understand the code"** → #1, #3, #4, #5
- **"I want to deploy to Azure"** → #1, #2, #13
- **"I want to bring my own backend"** → #1, #3 (API contract section), #13 (BYOB section)
- **"I want to customize the UI"** → #1, #6, #10, #11

---

_Last updated: 2026-03-04 | Last commit: cb3b21b_
