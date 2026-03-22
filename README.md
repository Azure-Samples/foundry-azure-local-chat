# Foundry Azure Local Chat

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/Azure-Samples/foundry-azure-local-chat)
[![Open in Dev Containers](https://img.shields.io/static/v1?style=for-the-badge&label=Dev%20Containers&message=Open&color=blue&logo=visualstudiocode)](https://vscode.dev/redirect?url=vscode://ms-vscode-remote.remote-containers/cloneInVolume?url=https://github.com/Azure-Samples/foundry-azure-local-chat)

A reusable Chat UI for AI experiences, built on the OpenAI Conversations API standard and Fluent AI components. It connects to a MS Foundry project and is designed to be deployed on Azure Kubernetes Service (AKS) clusters. The application features a chat interface chat history, streaming responses, and a pluggable provider architecture that supports both live MS Foundry backends and an in-memory mock mode for offline development.

Sample application code is included in this project. You can use or modify this app code or you can rip it out and include your own.

[Features](#features) • [Getting Started](#getting-started) • [Guidance](#guidance)


## Important Security Notice

This template, the application code and configuration it contains, has been built to showcase Microsoft Azure specific services and tools. We strongly advise our customers not to make this code part of their production environments without implementing or enabling additional security features.


<!-- Documentation page is a WIP, this link does not exist yet -->
For a more comprehensive list of best practices and security recommendations for Intelligent Applications, [visit our official documentation](#link)”

## Features

This project framework provides the following features:

* **On-prem & hybrid ready** — a ready-to-use chat experience that can be deployed in environments where data residency, network isolation, and on-prem or hybrid execution are required.
* **Chat history & conversation management** — sidebar with create, switch, rename, and delete
* **Streaming & stop** — real-time streaming responses with cancel support
* **Pluggable provider architecture**
  * Bring your own server — the UI is decoupled from the backend, so you can point it at any API
  * Add a custom AI provider — implement the server-side provider interface to connect any API (e.g., Chat Completions, Agents, or your own)
  * Swap the frontend API layer — switch the UI to a different backend with no component changes

  See the [Custom Providers Guide](docs/src/3-development/custom-providers.md) for details.

### Architecture Diagram


![ Architecture diagram showing that user input is provided to the AKS hybrid cluster, which hosts the frontend and  backend as separate
  pods behind an nginx ingress. With Workload Identity and OIDC token exchange through a managed identity, the backend calls the
  MS Foundry agent to generate responses](docs/images/architecture.png)

### Demo Video (TODO)

(Embed demo video here)


## Getting Started

You have a few options for getting started with this template. The quickest way to get started is [GitHub Codespaces](#github-codespaces), since it will setup all the tools for you, but you can also [set it up locally](#local-environment). You can also use a [VS Code dev container](#vs-code-dev-containers).

This template uses **gpt-4o-mini** which may not be available in all Azure regions. Check for [up-to-date region availability](https://learn.microsoft.com/azure/ai-services/openai/concepts/models#standard-deployment-model-availability) and select a region during deployment accordingly.

  * We recommend using **East US** or **Sweden Central**

### GitHub Codespaces

You can run this template virtually by using GitHub Codespaces. The button will open a web-based VS Code instance in your browser:

1. Open the template (this may take several minutes)
    [![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/Azure-Samples/foundry-azure-local-chat)
2. Open a terminal window
3. Sign into your Azure account:

    ```shell
     azd auth login --use-device-code
    ```

4. Provision the Azure resources and deploy your code:

    ```shell
    azd up
    ```

    The interactive setup wizard will guide you through selecting your subscription, AKS configuration, AI mode (mock/create/bring-your-own), and deployment settings.

5. Once deployment completes, `azd` will print the application URL. Open it in your browser to start chatting.

### VS Code Dev Containers

A related option is VS Code Dev Containers, which will open the project in your local VS Code using the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers):

1. Start Docker Desktop (install it if not already installed)
2. Open the project:
    [![Open in Dev Containers](https://img.shields.io/static/v1?style=for-the-badge&label=Dev%20Containers&message=Open&color=blue&logo=visualstudiocode)](placeholder)
3. In the VS Code window that opens, once the project files show up (this may take several minutes), open a terminal window.
4. Sign into your Azure account:

    ```shell
     azd auth login
    ```

5. Provision the Azure resources and deploy your code:

    ```shell
    azd up
    ```

6. Configure a CI/CD pipeline:

    ```shell
    azd pipeline config
    ```

### Local Environment

#### Prerequisites

* [Node.js 20+](https://nodejs.org/) and npm
* Install [azd](https://aka.ms/install-azd)
  * Windows: `winget install microsoft.azd`
  * Linux: `curl -fsSL https://aka.ms/install-azd.sh | bash`
  * MacOS: `brew tap azure/azd && brew install azd`
* [Python 3.9+](https://www.python.org/downloads/)
* [Git](https://git-scm.com/downloads)
* \[Windows Only\] [PowerShell](https://learn.microsoft.com/powershell/scripting/install/installing-powershell-on-windows) (latest version, with `pwsh.exe` on PATH)
* This template uses **gpt-4o-mini** which may not be available in all Azure regions. Check for [up-to-date region availability](https://learn.microsoft.com/azure/ai-services/openai/concepts/models#standard-deployment-model-availability) and select a region during deployment accordingly
  * We recommend using **East US** or **Sweden Central**

#### Quickstart

1. Bring down the template code:

    ```shell
    azd init --template foundry-azure-local-chat
    ```

2. Sign into your Azure account:

    ```shell
    azd auth login
    ```

3. Provision and deploy the project to Azure:

    ```shell
    azd up
    ```

    The interactive setup wizard will guide you through selecting your subscription, AKS configuration, AI mode (mock/create/bring-your-own), and deployment settings.

4. Once deployment completes, `azd` will print the application URL. Open it in your browser to start chatting.

5. Configure a CI/CD pipeline:

    ```shell
    azd pipeline config
    ```

#### Local Development

There are two ways to run the app locally without deploying to Azure:

##### Option 1 — Mock Mode (no Azure required)

Runs entirely offline with simulated AI responses. Ideal for UI development.

```bash
# Install frontend dependencies
npm install

# Install server dependencies
cd server && npm install && cd ..

# Copy the environment template and set mock mode
cp server/.env.example server/.env
# Edit server/.env and set DATASOURCES=mock

# Terminal 1: Start the frontend
npm run dev

# Terminal 2: Start the server
cd server && npm run start
```

The frontend runs at `http://localhost:5173` and the server at `http://localhost:3001`.

##### Option 2 — API Mode (connects to Microsoft Foundry)

Uses a real Microsoft Foundry agent for live AI responses.

1. Ensure you are logged in to Azure:

    ```shell
    az login
    ```

2. Configure the server environment:

    ```bash
    cp server/.env.example server/.env
    ```

    Edit `server/.env` and set:

    ```
    DATASOURCES=api
    AI_PROJECT_ENDPOINT=https://<your-resource>.services.ai.azure.com/api/projects/<your-project>
    AI_AGENT_ID=<agent-name>:<version>
    ```

3. Install dependencies and start both processes:

    ```bash
    # Terminal 1: Start the frontend
    npm install
    npm run dev

    # Terminal 2: Start the server
    cd server && npm install && npm run start
    ```

## Guidance

### Region Availability

This template uses **gpt-4o-mini** which may not be available in all Azure regions. Check for [up-to-date region availability](https://learn.microsoft.com/azure/ai-services/openai/concepts/models#standard-deployment-model-availability) and select a region during deployment accordingly
  * We recommend using **East US** or **Sweden Central**

### Costs

You can estimate the cost of this project's architecture with [Azure's pricing calculator](https://azure.microsoft.com/pricing/calculator/)

* [Azure Kubernetes Service enabled by Azure Arc](https://azure.microsoft.com/en-us/pricing/details/azure-arc/kubernetes-app-services-data-ai/)
* [Microsoft Foundry](https://azure.microsoft.com/pricing/details/ai-studio/)

### Security


This template has [Managed Identity](https://learn.microsoft.com/entra/identity/managed-identities-azure-resources/overview) built in to eliminate the need for developers to manage credentials. Applications can use managed identities to obtain Microsoft Entra tokens without having to manage any credentials. Additionally, we have added a [GitHub Action tool](https://github.com/microsoft/security-devops-action) that scans the infrastructure-as-code files and generates a report containing any detected issues. To ensure best practices in your repo we recommend anyone creating solutions based on our templates ensure that the [Github secret scanning](https://docs.github.com/code-security/secret-scanning/about-secret-scanning) setting is enabled in your repos.

## Resources (TODO)

* [Getting Started Guide](docs/src/1-getting-started/getting-started.md)
* [Features Documentation](docs/src/2-features/)
* [Development & Deployment](docs/src/3-development/)
* [Custom Providers Guide](docs/src/3-development/custom-providers.md)
* [Microsoft Foundry documentation](https://learn.microsoft.com/azure/ai-studio/)
