---
order: 2
---

# Development Plan

## Overview

Edge-Core-Chat is a **reusable chat UI solution** for AI experiences on Azure Arc, packaged as a Foundry template. The project spans three workstreams: the core Foundry template, Silver team integration (BYOM), and Edge RAG integration.

## Completed Phases

### Phase 1: Core Chat UI ✅
- Chat UI component with Fluent AI Copilot components
- Message rendering with markdown, streaming support
- Theme system (light/dark/system), localization (i18n)
- Conversation history sidebar with CRUD operations
- Route-based navigation, atomic message pattern

### Phase 2: Reference Server ✅
- Express server with pluggable DataProvider architecture
- Three providers: `mock` (offline dev), `api` (Azure AI Foundry), `byom` (any OpenAI endpoint)
- Azure AI Foundry integration via Agents API
- Admin routes for runtime datasource/streaming toggles
- Configuration system via environment variables

### Phase 3: Azure Deployment ✅
- Azure Developer CLI (`azd`) - single-command deploy with 8 vars
- Bicep IaC: AKS + ACR + Managed Identity + Federated Credential
- K8s on Arc deployment mode (stable, battle-tested)
- Workload Identity end-to-end (secretless, cross-RG RBAC)
- FE-only deployment mode (BYOB)
- Pod resource right-sizing for edge hardware
- Deployment hooks with CI automation (`-y` flag)
- `connect-foundry.sh` - switch mock → API without re-provisioning
- Documentation site: deployment guide, cookbooks, environment reference

### Phase 3.5: Interactive Setup & AI Provisioning ✅
- Interactive setup wizard with arrow-key navigation (region, prefix, VM size, AI mode, model, backend settings)
- AI Foundry auto-provisioning (`create` mode) via Bicep modules
- Agent auto-creation via Node.js AI Projects SDK
- Model quota validation before provisioning
- Infrastructure locking after first provision (prevents accidental teardown)
- Resource cleanup prompts on config changes
- Infrastructure auto-detection from existing Azure resources (reuse without re-provision)
- Shared prompt library (`infra/prompts.sh`) for consistent interactive UX across hooks

## Current Phase

### Phase 4: Template Publication & Team Integrations 🔶

We're now operating on three parallel tracks:

**Foundry Template Readiness** (9/18 PBIs done)
- Architectural decisions - deployment modes, AI Foundry provisioning model ([#36947847](https://msazure.visualstudio.com/One/_workitems/edit/36947847))
- Cross-platform - Windows deployment + DevContainers ([#36947848](https://msazure.visualstudio.com/One/_workitems/edit/36947848))
- AI Foundry Bicep module + monitoring ([#36947849](https://msazure.visualstudio.com/One/_workitems/edit/36947849))
- CI/CD pipelines + Azure Samples OSS release
- Template gallery listing + Foundry discover page

**Silver Team Integration** ([#36696988](https://msazure.visualstudio.com/One/_workitems/edit/36696988))
- BYOM provider in progress by Chris - mTLS + API key auth, disconnected-ready ([PR #14874116](https://dev.azure.com/msazure/One/_git/Edge-Core-Chat/pullrequest/14874116))
- Pending: code review → Design Review → task breakdown

**Edge RAG Integration** ([#36696995](https://msazure.visualstudio.com/One/_workitems/edit/36696995))
- FE-only approach with thin transformer service
- RAG provides backend, we provide Chat UI + adapter layer
- Pending: Design Review → task breakdown

## Future Enhancements

- Citations rendering (document references with relevance scores)
- Conversation search/filter
- Message editing/regeneration
- Export conversation history
- Conversation templates

---

*Last updated: 2025-07-15*
