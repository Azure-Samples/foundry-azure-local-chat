# Foundry azure local chat

A reusable Chat UI for AI experiences, built on the OpenAI Conversations API standard and Fluent AI components. It connects to an Azure AI Foundry project via the Foundry reference server and is designed to be deployed on Azure Arc–enabled Kubernetes clusters.

## Features

This project framework provides the following features:

- **OpenAI Conversations API standard** — future-proof contract with pure TypeScript types
- **Copilot-like UI** — built with Fluent AI components (`@fluentui-copilot`)
- **Chat history & conversation management** — sidebar with create, switch, rename, and delete
- **Mock mode** — develop UI without a backend
- **Theme support** — Light, Dark, and System preference
- **Streaming & stop** — real-time streaming responses with cancel support
- **Type-safe configuration** — centralized config with IDE autocomplete
- **Azure deployment** — one-command deploy via `azd up` with recipe presets

## Getting Started

### Prerequisites

- Node.js 20+
- npm


### Quickstart

#### Local Development
```bash
# Terminal 1: Start frontend
npm install
npm run dev
# Configure server
# Terminal 2: Start server
cp server/.env.example server/.env
# Edit server/.env — set DATASOURCES=mock for quick test,
# or set AI_PROJECT_ENDPOINT & AI_AGENT_ID for Azure AI Foundry
cd server && npm install && npm run start
```

### Launch Deployment
Make sure the following tools are installed:

   - [Azure Developer CLI (azd)](https://aka.ms/install-azd) Install or update to the latest version. Instructions can be found on the linked page.
   - [Python 3.9+](https://www.python.org/downloads/)
   - [Git](https://git-scm.com/downloads)
   - \[Windows Only\] [PowerShell](https://learn.microsoft.com/powershell/scripting/install/installing-powershell-on-windows) of the latest version, needed only for local application development on Windows operating system. Please make sure that path to PowerShell executable `pwsh.exe` is added to the `PATH` variable.
Deploy a chat UI in Kubernetes enabled by Azure Arc with Foundry.
```bash
azd up
# choose All option
```

## Resources

- [Getting Started Guide](docs/src/1-getting-started/getting-started.md)
- [Features Documentation](docs/src/2-features/)
- [Deployment to Azure](docs/src/3-development/)
