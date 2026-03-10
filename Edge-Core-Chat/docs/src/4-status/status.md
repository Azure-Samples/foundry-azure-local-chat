---
order: 1
---

# Status

**Last updated:** 2026-03-01

**Epic:** [#36457969](https://msazure.visualstudio.com/One/_workitems/edit/36457969)

## Progress Overview

| Workstream | Feature | PBIs | Status |
|------------|---------|------|--------|
| **Foundry Template** | [#36568628](https://msazure.visualstudio.com/One/_workitems/edit/36568628) | 9/18 done | 🔶 Hardening for publication |
| **Silver Team** | [#36696988](https://msazure.visualstudio.com/One/_workitems/edit/36696988) | DR pending | 🔶 BYOM provider delivered |
| **Edge RAG** | [#36696995](https://msazure.visualstudio.com/One/_workitems/edit/36696995) | DR pending | 🔶 FE-only approach decided |

---

## Foundry Template

**Goal:** Publish Edge-Core-Chat as an official `azd` Foundry template - a full-stack, reusable chat solution on Arc-connected AKS.

**Status:** The core solution is live and stable. A single `azd up` deploys FE+BE to Arc-connected AKS with Workload Identity - no secrets anywhere. Teams choose between AI Foundry, Bring Your Own Model, or mock mode by changing an environment variable. Frontend also deploys standalone for teams bringing their own backend. Disconnected-capable, edge-optimized, and OSS compliant.

**Feature:** [#36568628](https://msazure.visualstudio.com/One/_workitems/edit/36568628) - 9 Done, 2 Active (Sharon), 7 Open

### Completed

| Area | Status |
|------|--------|
| K8s on Arc - full stack (FE+BE) | ✅ Stable - running quality tests on 2 clusters |
| K8s on Arc - FE only (BYOB) | ✅ Stable - pointing at pre-deployed backend |
| Pod resource right-sizing | ✅ Split request/limit, fits D2s_v3 2-node clusters |
| CI automation (`-y` flag) | ✅ All hooks support `--yes` / `AUTO_YES` |
| Workload Identity (secretless) | ✅ Managed Identity + Federated Credential + K8s SA |
| Cross-RG RBAC for AI Foundry | ✅ postprovision.sh assigns roles on external AI Foundry RG |
| Bicep IaC (AKS + ACR + Identity) | ✅ Shared infra, one-command deploy |
| Documentation | ✅ Deployment guide, cookbooks, env reference |

### In Progress

We're continuing to harden the template for publication while operating on three parallel tracks:

**P1 - Blocks template publication**

| # | Task | ADO PBI | Status |
|---|------|---------|--------|
| 1 | Architectural decisions (container-app mode, AI Foundry provisioning model) | [#36947847](https://msazure.visualstudio.com/One/_workitems/edit/36947847) | ⬜ Decision needed |
| 2 | Windows deployment + DevContainers | [#36947848](https://msazure.visualstudio.com/One/_workitems/edit/36947848) | 🔶 In progress |
| 3 | Decide on AI Foundry resource provisioning and monitoring strategy | [#36947849](https://msazure.visualstudio.com/One/_workitems/edit/36947849) | ❌ Not started |

**P2 - Template quality**

| # | Task | ADO PBI | Status |
|---|------|---------|--------|
| 4 | CI/CD workflows | [#36569479](https://msazure.visualstudio.com/One/_workitems/edit/36569479) | ❌ Not started |
| 5 | Template gallery + Foundry discover page | [#36569484](https://msazure.visualstudio.com/One/_workitems/edit/36569484) | 🔶 Partial |
| 6 | Azure Samples OSS release | [#36696293](https://msazure.visualstudio.com/One/_workitems/edit/36696293) | 🔄 Sharon driving |
| 7 | Code action items before publish | [#36752155](https://msazure.visualstudio.com/One/_workitems/edit/36752155) | 🔄 Sharon driving |

### Completed PBIs

[#36584564](https://msazure.visualstudio.com/One/_workitems/edit/36584564) Initial Chat UI Infrastructure · [#36569467](https://msazure.visualstudio.com/One/_workitems/edit/36569467) Chat Component · [#36569469](https://msazure.visualstudio.com/One/_workitems/edit/36569469) Theme Provider · [#36569480](https://msazure.visualstudio.com/One/_workitems/edit/36569480) Localization · [#36569509](https://msazure.visualstudio.com/One/_workitems/edit/36569509) Design Review · [#36881428](https://msazure.visualstudio.com/One/_workitems/edit/36881428) Arc Deployment Infra · [#36696155](https://msazure.visualstudio.com/One/_workitems/edit/36696155) Full Solution Deployment · [#36569470](https://msazure.visualstudio.com/One/_workitems/edit/36569470) API Provider

---

## Silver Team Integration

**Goal:** Integrate Chat UI with Silver team's backend APIs, supporting mTLS and disconnected scenarios.

**Status:** Chris (Silver team) is working on a **BYOM (Bring Your Own Model) provider** in [PR #14874116](https://dev.azure.com/msazure/One/_git/Edge-Core-Chat/pullrequest/14874116), adding support for mTLS and API key authentication against any OpenAI-compatible endpoint, with an in-memory conversation store for disconnected scenarios. PR is active and under review.

**Feature:** [#36696988](https://msazure.visualstudio.com/One/_workitems/edit/36696988) - PBIs to be created after DR with stakeholders

**Sync:** Mon & Wed 16:30-17:00 with Chris (Silver team)

### Completed

| Area | Status |
|------|--------|
| Integration pattern | ✅ Decided - extend backend with new provider (not FE-only) |
| BYOM Provider | ✅ Full DataProvider implementation (746 lines) |
| mTLS + API key auth | ✅ Dual auth, persistent `https.Agent` |
| In-memory store | ✅ Disconnected-ready, no external dependencies |
| 3-way datasource toggle | ✅ `mock` \| `api` \| `byom` via admin routes |
| Docs + `.env.example` | ✅ BYOM setup guide |

### Next Steps

- Review and merge PR #14874116
- **Design Review** with stakeholders ([#36947898](https://msazure.visualstudio.com/One/_workitems/edit/36947898)) → task breakdown
- Test BYOM on deployed Arc cluster with mTLS certificates

---

## Edge RAG Integration

**Goal:** Replace RAG team's existing developer portal chat UI with Edge-Core-Chat, connecting to their inferencing API via a lightweight transformer layer.

**Status:** Completed a deep analysis of RAG's API surface and codebase. Integration approach decided: FE-only with a thin transformer service - RAG provides the backend, we provide the Chat UI and an adapter translating their API to our component layer. This unlocks citations rendering as a new capability for the chat experience. RAG is also adopting Foundry Agents API.

**Feature:** [#36696995](https://msazure.visualstudio.com/One/_workitems/edit/36696995) - PBIs to be created after DR with stakeholders

**Sync:** Wed 14:30-15:00 with RAG team

### Architecture

```
RAG Backend (FastAPI + Dapr)  →  Transformer (thin adapter)  →  Edge-Core-Chat UI
     /edgeai/chat/completions       maps RAG contracts to            React components
     Foundry Agents API             our UI component layer
```

### RAG API Surface

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/edgeai/chat/completions` | POST | RAG with vector search + LLM |
| `/edgeai/slm/chat/completions` | POST | Direct SLM completions |
| `/edgeai/vi/chat/completions` | POST | Video Indexer-enhanced RAG |
| `/edgeai/chat/feedback` | POST/GET | Thumbs up/down feedback |

### What We Need to Build

1. **Transformer service** - adapter mapping RAG responses to our UI component interfaces
2. **Citations rendering** - document citations with relevance scores (new FE feature)

### Next Steps

- **Design Review** with stakeholders ([#36947899](https://msazure.visualstudio.com/One/_workitems/edit/36947899)) → task breakdown
- Define transformer contract
- Scope citations rendering in Chat UI

---

## Dependencies

Both Silver and RAG integrations require **Design Reviews** before breaking down into implementation tasks - scheduling is our next priority.

**Syncs:**
- Silver team (Chris): Mon & Wed 16:30-17:00
- Edge RAG team: Wed 14:30-15:00

---

*Last updated: 2026-03-01*
