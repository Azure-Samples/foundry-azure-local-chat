# What's New Since Last Sync

## TL;DR

`azd up` now does everything — interactive wizard, AI Foundry provisioning, agent creation, and deployment. `./hooks/deploy.sh` is the fast path for redeploying current settings. Works on bash 3.2+.

> **⚠️ Important:** The `azd` environment name IS the resource prefix. `azd env new my-chat` creates `my-chat-rg`, `my-chat-cluster`, `my-chat-ai-hub`, etc. Choose a meaningful name — it's permanent after first provision. Don't use generic names like "test" or "dev".

---

## What Changed

### Naming Convention
- **Environment name = resource prefix** — `azd env new or-chat-k8s-v2` creates:
  - `or-chat-k8s-v2-rg` (resource group)
  - `or-chat-k8s-v2-cluster` (AKS)
  - `or-chat-k8s-v2-ai-hub` (AI Foundry)
  - `or-chat-k8s-v2-backend-id` (managed identity)
  - `orchatk8sv2acr` (ACR, alphanumeric only)
- Prefix is locked after first provision — can't be changed without `azd down`
- `ARC_PREFIX` is never prompted — always derived from `AZURE_ENV_NAME`

### Deploy Experience
- **One command:** `azd up` walks you through everything with arrow-key selectors
- **Recipes:** `azd env set RECIPE all && azd up` — zero prompts, full stack + AI
- **Re-run:** after first deploy, shows "Deploy / Modify" (not full wizard again)
- **deploy.sh:** standalone `./hooks/deploy.sh` is the fast path — shows summary, confirms, deploys. No wizard. Use `azd up` to modify settings.
- **Auto-deploy:** wizard asks to skip deploy confirmation, so provision → deploy is seamless
- **Bash 3.2+ compatible:** dropped associative array cache, reads/writes `.env` file directly

### AI Foundry Automated
- Bicep creates hub + project + model deployment
- Agent created via Node.js SDK after provision
- Quota validated before deploy
- RBAC (3 roles) assigned automatically

### Cross-Machine Resume
- `azd env new <prefix> && azd up` — auto-detects everything
- 8 RG tags store config (scope, streaming, CORS, admin, agent-id, recipe, datasources, deploy-done)
- AI_MODE derived from hub existence (no tag)
- Local `azd env set` always wins over tags

### Safety
- Infra locked after provision. `azd down` to unlock
- Cleanup prompts on scope narrowing or AI mode change
- No secrets in tags

### Testing
- `scripts/test-deploy-matrix.sh` — 35 dry-run tests covering config validation, manifests, transitions, CWD-independence, Container Apps, frontend-only, BYO cross-RG. No Azure needed.

---

## How to Review

3 stacked PRs — review in order, each builds on the previous:

| PR | What | Files | Review focus |
|----|------|-------|-------------|
| [#14942891](https://dev.azure.com/msazure/One/_git/Edge-Core-Chat/pullrequest/14942891) | **Wizard + recipes** | 9 | `prompts.sh` UX, `defaults.sh` detection logic, recipe defaults |
| [#14942893](https://dev.azure.com/msazure/One/_git/Edge-Core-Chat/pullrequest/14942893) | **AI Foundry** | 8 | `ai-foundry.bicep` resources, `create-agent.js` SDK, RBAC via hooks (deletes ai-rbac.bicep) |
| [#14942896](https://dev.azure.com/msazure/One/_git/Edge-Core-Chat/pullrequest/14942896) | **Deploy state** | 12 | RG tags, `deploy.sh` modify flow, cleanup logic |

Each PR diff shows only its own files. PR 3's branch has the full runnable code.

### Quick test (no Azure)
```bash
git checkout feat/orschneider/deploy-state-management
bash scripts/test-deploy-matrix.sh
```

### Test with Azure
```bash
git checkout feat/orschneider/deploy-state-management
azd env set RECIPE all && azd up
./hooks/deploy.sh                    # fast redeploy, no wizard
```

---

## How to Test

```bash
# Dry-run (no Azure)
bash scripts/test-deploy-matrix.sh

# Fresh deploy
azd env set RECIPE all && azd up

# Fast redeploy (no provision, no wizard)
./hooks/deploy.sh

# Resume from another machine
azd env new or-chat-k8s-v2 && azd up
```

---

## Not Tested Yet

- Container Apps mode (untested since wizard changes)
- Windows PowerShell wrappers
- BYO AI with cross-RG RBAC
- Frontend-only deploy with external backend
