# Edge-Core-Chat — Support Matrix

## Deployment Configurations

### Scope × AI Mode Matrix

| | **create** | **byo** | **mock** |
|---|---|---|---|
| **all** (FE+BE) | ✅ **VERIFIED** — full E2E works | ⚠️ Needs test | ⚠️ Needs test |
| **backend** only | ⚠️ Needs test | ⚠️ Needs test | ⚠️ Needs test |
| **frontend** only | N/A (no backend) | N/A (no backend) | N/A (no backend) |

### What Each Combination Does

| Scope | AI Mode | Infra Created | K8s Deployed | Notes |
|-------|---------|---------------|-------------|-------|
| all + create | AKS, ACR, AI Hub, Project, Model, Identity | BE + FE + Ingress | Full automated setup |
| all + byo | AKS, ACR, Identity | BE + FE + Ingress | RBAC on external AI RG |
| all + mock | AKS, ACR, Identity | BE + FE + Ingress | No AI calls, dummy responses |
| backend + create | AKS, ACR, AI Hub, Project, Model, Identity | BE + Ingress | No frontend |
| backend + byo | AKS, ACR, Identity | BE + Ingress | No frontend |
| backend + mock | AKS, ACR, Identity | BE + Ingress | No frontend, no AI |
| frontend + * | AKS, ACR | FE + Ingress | Requires VITE_API_URL |

---

## Feature Status

### ✅ Working & Tested

| Feature | Status | Notes |
|---------|--------|-------|
| Interactive wizard (arrow keys) | ✅ | All selectors work |
| Region selection (popular + more) | ✅ | azd native handles it |
| VM size selection | ✅ | Popular + More + Custom |
| Model selection | ✅ | Popular + More + Custom |
| Model quota validation | ✅ | Checks TPM before deploy |
| Config summary box | ✅ | Shows all settings |
| Infrastructure locking | ✅ | Read-only after first provision |
| WIZARD_DONE flag | ✅ | Tracks completion |
| Cached env access | ✅ | Single azd call, ~2.5s |
| Esc-back navigation | ✅ | VM + Model expanded lists |
| `← current` markers | ✅ | Shows previous selections |
| AKS + OIDC + Workload Identity | ✅ | Bicep creates all |
| ACR + image build | ✅ | az acr build in deploy |
| Arc connection | ✅ | postprovision hook |
| AI Foundry hub + project | ✅ | Bicep creates both |
| Model deployment | ✅ | Bicep, fixed name `${prefix}-chat` |
| RBAC (create mode) | ✅ | postprovision via az CLI |
| Agent creation | ✅ | Node.js SDK script |
| Self-signed TLS | ✅ | Created in deploy hook |
| CORS auto-detect | ✅ | From ingress IP |
| Ingress (nginx) | ✅ | App routing addon |
| `-y` flag (CI mode) | ✅ | Skips all prompts |

### ⚠️ Partially Working / Needs Verification

| Feature | Status | What to test |
|---------|--------|-------------|
| BYO mode RBAC | ⚠️ | Test with AI in different RG + subscription |
| BYO auto-detect RG | ⚠️ | Test with real AI Foundry endpoint |
| Scope change cleanup | ⚠️ | Test all→backend, all→frontend transitions |
| AI mode change cleanup | ⚠️ | Test create→mock with delete prompt |
| Infra detection (new machine) | ✅ | `infra/defaults.sh` auto-detects from Azure resources + RG tags |
| Backend-only deploy | ⚠️ | Test scope=backend end-to-end |
| Frontend-only deploy | ⚠️ | Test scope=frontend with external API |
| Container Apps mode | ⚠️ | Untested since wizard changes |
| Windows (PowerShell) | ⚠️ | PS1 wrappers exist but untested |

### ❌ Not Implemented / Known Gaps

| Feature | Status | Priority |
|---------|--------|----------|
| Node count scaling (post-provision) | ❌ | Low — AKS supports it but wizard locks infra |
| VM size change (post-provision) | ❌ | Low — requires node pool recreate |
| Agent update/recreate | ❌ | Med — what if model changes? |
| Storage Account for AI Hub | ❌ | Med — Azure sample includes it |
| Application Insights | ❌ | Low — monitoring/tracing |
| RAG / Search Service | ❌ | Low — knowledge retrieval |
| Key Vault | ❌ | Low — secret management |
| DNS / custom domain | ❌ | Low — TLS cert with real domain |
| Multiple model deployments | ❌ | Low — currently single model |
| Agent instructions customization | ❌ | Low — hardcoded in script |

---

## Configuration Change Matrix

### What happens when you change settings between `azd up` runs

| Change | Safe? | What happens | Cleanup |
|--------|-------|-------------|---------|
| **Node count** 2→4 | ✅ | AKS scales up | None needed |
| **Streaming** on→off | ✅ | Pod env var change | Auto (redeploy) |
| **CORS** auto→* | ✅ | Pod env var change | Auto (redeploy) |
| **Admin** false→true | ✅ | Pod env var change | Auto (redeploy) |
| **Model capacity** 1→5 | ✅ | Bicep updates SKU | Auto |
| **Model name** mini→4o | ⚠️ | Bicep updates deployment (fixed name) | Old model gone |
| **Scope** all→backend | ⚠️ | Prompts to remove FE | User choice |
| **Scope** all→frontend | ⚠️ | Prompts to remove BE | User choice |
| **AI** create→mock | ⚠️ | Prompts to delete AI resources | User choice |
| **AI** create→byo | ⚠️ | Prompts to delete AI resources | User choice |
| **AI** mock→create | ✅ | Additive — creates new resources | None |
| **AI** byo→create | ✅ | Additive — new resources | None |
| **Prefix** change | 🔒 | Locked — must `azd down` first | Full teardown |
| **Region** change | 🔒 | Locked — must `azd down` first | Full teardown |
| **VM size** change | 🔒 | Locked — must `azd down` first | Full teardown |

---

## End-to-End Test Plan

### Scenario 1: Fresh Deploy (create mode)
```
azd env new test-create
azd up
→ Wizard: prefix, VM, scope=all, AI=create, model=gpt-4o-mini
→ Bicep: AKS + ACR + AI Hub + Project + Model
→ Postprovision: RBAC + Agent creation
→ Deploy: Build images + K8s manifests
→ Verify: curl https://IP/health → 200
→ Verify: curl https://IP/api/responses → AI response
```

### Scenario 2: Fresh Deploy (mock mode)
```
azd env new test-mock
azd up
→ Wizard: prefix, VM, scope=all, AI=mock
→ Bicep: AKS + ACR (no AI resources)
→ Deploy: Build images + K8s manifests
→ Verify: curl https://IP/health → 200
→ Verify: curl https://IP/api/responses → mock response
```

### Scenario 3: BYO Mode
```
azd env new test-byo
azd env set AI_PROJECT_ENDPOINT "https://existing-hub.cognitiveservices.azure.com/api/projects/existing-project"
azd env set AI_AGENT_ID "my-agent:1"
azd up
→ Wizard: prefix, VM, scope=all, AI=byo
→ Bicep: AKS + ACR (no AI resources)
→ Postprovision: RBAC on external RG
→ Deploy: Build images + K8s manifests
→ Verify: AI responses work with external agent
```

### Scenario 4: Switch from create → mock
```
azd up (already provisioned with create)
→ Wizard: change AI mode to mock
→ Prompt: "Delete AI resources?" → yes
→ Postprovision: deletes AI hub
→ Deploy: backend uses mock responses
```

### Scenario 5: Scope change all → backend
```
azd up (already deployed all)
→ Wizard: change scope to backend
→ Prompt: "Remove frontend?" → yes
→ Deploy: deletes FE pods, only deploys BE
```

### Scenario 6: Re-run (no changes)
```
azd up (already provisioned + deployed)
→ Shows Deploy/Modify choice (not full wizard)
→ Deploy → summary → provision (no-op) → deploy (rolling restart)
→ Modify → wizard with locked infra → change app settings → deploy
```

### Scenario 7: New machine (resume existing deployment)
```
git clone repo
azd env new existing-prefix    # env name = cluster prefix
azd env set AZURE_SUBSCRIPTION_ID <sub-id>
azd up
→ infra/defaults.sh auto-detects from Azure (AKS, ACR, identity)
→ infra/defaults.sh reads config from RG tags (scope, streaming, CORS, etc.)
→ AI_MODE derived from hub existence (no tag needed)
→ PROVISION_DONE=true → shows Deploy/Modify choice (not full wizard)
→ Deploy → summary → provision (no-op) → deploy
```

> **RG tag detection:** `apply_defaults()` reads deployment config from resource group tags (`DEPLOY_SCOPE`, `STREAMING`, `CORS_ORIGINS`, `ENABLE_ADMIN_ROUTES`, `AI_AGENT_ID`, etc.) and derives `AI_MODE` from AI hub existence. Local `azd env set` values always take priority over tags.

---

*Last updated: 2026-03-05 | Last commit: cb3b21b*
