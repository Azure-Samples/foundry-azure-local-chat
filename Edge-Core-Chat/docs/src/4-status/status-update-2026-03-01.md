---
order: 3
---

# Status Update - 2026-03-01

**Epic:** [#36457969](https://msazure.visualstudio.com/One/_workitems/edit/36457969)

---

Providing a status update on Edge-Core-Chat. We've reached a significant milestone - the core chat solution is deployed, battle-tested, and stable. Beyond the UI, we invested heavily in infrastructure, deployment automation, identity, and edge readiness to ensure the solution is production-grade from day one. We're now kickstarting the integration phases with Silver and Edge RAG teams in parallel with finalizing the template for publication.

## Completed

**Foundry Template** ([#36568628](https://msazure.visualstudio.com/One/_workitems/edit/36568628)) - Full-stack chat solution live on Arc-connected AKS - frontend, backend, and infrastructure, all deployed with a single `azd up` command.

- **Pluggable backends** - Teams choose between AI Foundry, Bring Your Own Model (BYOM), or mock mode. Switching requires zero code changes - just an environment variable.
- **Frontend independence** - The Chat UI can deploy standalone against any backend, enabling teams to bring their own server while using our UI components.
- **Disconnected-ready** - Works offline on Arc with pre-pulled images, no cloud dependencies at runtime.
- **Secretless identity** - Workload Identity end-to-end, zero secrets in code or config.
- **OSS compliant** - MIT license, SECURITY.md, CODE_OF_CONDUCT.md, CONTRIBUTING.md in place.

We invested heavily in the infrastructure layer - IaC, Arc connectivity, cross-RG identity management, and deployment automation. All battle-tested across multiple clusters and deployment scenarios. Running stable with quality tests ongoing.

**Silver Team Integration** ([#36696988](https://msazure.visualstudio.com/One/_workitems/edit/36696988)) - Chris (Silver team) is working on a **BYOM (Bring Your Own Model) provider** ([PR #14874116](https://dev.azure.com/msazure/One/_git/Edge-Core-Chat/pullrequest/14874116)), adding support for **mTLS and API key authentication** against any OpenAI-compatible endpoint, with an in-memory conversation store for disconnected scenarios. PR is active and under review.

**Edge RAG Integration** ([#36696995](https://msazure.visualstudio.com/One/_workitems/edit/36696995)) - Deep analysis of RAG's API surface and codebase complete. Integration approach decided: **FE-only with a thin transformer service** - RAG provides the backend, we provide the Chat UI and an adapter layer. This unlocks citations rendering as a new capability.

## Next Up

**Foundry Template Readiness** - Finalizing for publication (9/18 PBIs done):

- Architectural decisions on deployment modes and AI Foundry provisioning model ([#36947847](https://msazure.visualstudio.com/One/_workitems/edit/36947847))
- Cross-platform support - Windows deployment + DevContainers for one-click Codespaces experience ([#36947848](https://msazure.visualstudio.com/One/_workitems/edit/36947848))
- Decide on AI Foundry resource provisioning and monitoring strategy ([#36947849](https://msazure.visualstudio.com/One/_workitems/edit/36947849))
- CI/CD pipelines + Azure Samples OSS release

**Integration Design Reviews** - Both Silver and RAG require DRs with stakeholders before breaking down into implementation tasks:

- Silver DR ([#36947898](https://msazure.visualstudio.com/One/_workitems/edit/36947898)) - Review BYOM architecture, mTLS flow, deployment model
- RAG DR ([#36947899](https://msazure.visualstudio.com/One/_workitems/edit/36947899)) - Review transformer architecture, citations UX, API contract

**Syncs:**

- Silver team (Chris): Mon & Wed 16:30-17:00
- Edge RAG team: Wed 14:30-15:00
