---
order: 6
---

# DevContainer

A ready-to-use [Dev Container](https://containers.dev/) is included so you can start developing with zero local setup. It works with **GitHub Codespaces**, **VS Code Dev Containers**, and any tool that supports the devcontainer spec.

## What's Included

| Component | Details |
| --------- | ------- |
| **Base image** | `mcr.microsoft.com/devcontainers/javascript-node:22` (Node.js 22) |
| **Azure Developer CLI** | `azd` — provision and deploy with a single command |
| **Azure CLI** | `az` — manage Azure resources |
| **kubectl** | Kubernetes CLI for cluster management |
| **Docker-in-Docker** | Build and push container images from inside the container |

### VS Code Extensions

The container auto-installs these extensions:

- **Azure Developer CLI** (`ms-azuretools.azure-dev`)
- **Bicep** (`ms-azuretools.vscode-bicep`)
- **ESLint** (`dbaeumer.vscode-eslint`)
- **Docker** (`ms-azuretools.vscode-docker`)

### Editor Settings

- `editor.formatOnSave` is enabled by default.

## Getting Started

### GitHub Codespaces

1. Open the repo on GitHub
2. Click **Code → Codespaces → New codespace**
3. Wait for the container to build — dependencies install automatically
4. Run `az login` then `azd up` to deploy

### VS Code (local)

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) and the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)
2. Clone the repo and open it in VS Code
3. When prompted **"Reopen in Container"**, click yes (or run `Dev Containers: Reopen in Container` from the command palette)
4. Wait for the container to build — dependencies install automatically
5. Run `az login` then `azd up` to deploy

## Post-Create Setup

The container automatically runs `.devcontainer/post-create-command.sh` after creation, which:

1. Installs frontend dependencies (`npm install`)
2. Installs server dependencies (`cd server && npm install`)

## Forwarded Ports

| Port | Service |
| ---- | ------- |
| 5173 | Vite dev server (frontend) |
| 3001 | Express server (backend) |

## Requirements

The container requires a minimum of **8 GB RAM** on the host machine.

---
*Last updated: 2026-03-08*
