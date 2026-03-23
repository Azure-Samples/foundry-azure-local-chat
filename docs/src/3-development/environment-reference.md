---
order: 3
---

# Environment Reference

Complete reference for all `azd` environment variables used by foundry-azure-local-chat. Most are set automatically by the [interactive setup wizard](/3-development/deployment.md#interactive-setup-wizard) — manual `azd env set` is optional.

## Infrastructure

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RECIPE` | - | - | Deployment recipe: `all` (full stack + MS Foundry), `dev` (mock + cheapest VM), or empty for interactive wizard |
| `ARC_PREFIX` | auto | - | Auto-derived from azd environment name — do NOT set manually |
| `NODE_COUNT` | ✅ | - | AKS node count (e.g. `2`) |
| `VM_SIZE` | ✅ | - | AKS VM size (e.g. `Standard_D2s_v3`) |
| `DEPLOY_MODE` | ✅ | - | `k8s` or `containerapp` |
| `DEPLOY_SCOPE` | - | `all` | `all`, `frontend`, or `backend` |
| `AZURE_LOCATION` | auto | - | Set during `azd init` (region dropdown) |
| `CUSTOM_LOCATION_OID` | containerapp | - | Custom Locations RP Object ID ([how to get](/3-development/deployment.md#getting-custom-location-oid)) |
| `AI_RESOURCE_GROUP` | - | - | RG containing MS Foundry — enables cross-RG RBAC |
| `AZURE_WI_CLIENT_ID` | auto | - | Managed Identity client ID — set by Bicep output |

## AI Configuration

Set by wizard step ③. `AI_MODE` determines which other variables are needed.

| Variable | Default | Used in mode | Description |
|----------|---------|-------------|-------------|
| `AI_MODE` | `byo` | all | `create` (auto-provision MS Foundry hub, project, model), `byo` (existing project), or `mock` (dummy responses). Auto-derived from hub existence on resume |
| `AI_MODEL_NAME` | `gpt-4o-mini` | create | Model to deploy — wizard shows available models with quota |
| `AI_MODEL_VERSION` | `2024-07-18` | create | Model version — auto-detected from selected model when possible |
| `AI_MODEL_CAPACITY` | `1` | create | Model capacity in K TPM — validated against subscription quota before deploy |
| `AI_PROJECT_ENDPOINT` | - | create, byo | MS Foundry project endpoint. Auto-set in create mode, required in byo mode |
| `AI_AGENT_ID` | - | create, byo | MS Foundry agent ID (`name:version`). Auto-created in create mode via `server/scripts/create-agent.js`, persisted as RG tag for cross-machine resume |
| `DATASOURCES` | `mock` | all | `mock` or `api` — auto-set by wizard based on AI_MODE |

## App Settings (pod runtime)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `/api` | Backend API URL — defaults to `/api` (proxied to `localhost:3001` in dev, relative path in production). Required for `DEPLOY_SCOPE=frontend` when backend is on a different host. In Docker, can be overridden at runtime via env var (see [Docker Runtime Configuration](/3-development/deployment.md#docker-runtime-configuration)) |
| `STREAMING` | `enabled` | `enabled` or `disabled` -- SSE streaming for responses |
| `CORS_ORIGINS` | `auto` | `auto` detects from frontend ingress URL at deploy time, `*` allows all origins, or a specific URL |
| `ENABLE_ADMIN_ROUTES` | `false` | Enable `/api/admin/*` endpoints for runtime toggles |

## Resource Sizing

Set by `preprovision.sh` defaults — override with `azd env set`:

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKEND_REPLICAS` | `1` | Backend replica count |
| `FRONTEND_REPLICAS` | `1` | Frontend replica count |
| `BACKEND_CPU` | `250m` | Backend CPU limit (burst ceiling) |
| `BACKEND_CPU_REQUEST` | `50m` | Backend CPU request (scheduling reservation) |
| `BACKEND_MEMORY` | `512Mi` | Backend memory limit |
| `BACKEND_MEMORY_REQUEST` | `256Mi` | Backend memory request |
| `FRONTEND_CPU` | `100m` | Frontend CPU limit |
| `FRONTEND_CPU_REQUEST` | `10m` | Frontend CPU request |
| `FRONTEND_MEMORY` | `128Mi` | Frontend memory limit |
| `FRONTEND_MEMORY_REQUEST` | `64Mi` | Frontend memory request |
| `IMAGE_TAG` | `latest` | Container image tag |

## Wizard State

Set automatically by the setup wizard. These track deployment state for the wizard's change-detection logic. On resume (new machine), `PROVISION_DONE` is auto-set by `infra/defaults.sh` when it detects existing Azure resources. Config state (scope, streaming, CORS, etc.) is persisted as RG tags for cross-machine resume — local `azd env set` values always take priority over tags.

| Variable | Description |
|----------|-------------|
| `WIZARD_DONE` | `true` after wizard completes — indicates config validated interactively |
| `PROVISION_DONE` | `true` after first provision — locks infrastructure settings (prefix, region, nodes, VM size). Run `azd down` to unlock |
| `PREV_DEPLOY_SCOPE` | Previous deploy scope — used to detect scope narrowing and offer cleanup of now-unused pods |
| `PREV_AI_MODE` | Previous AI mode — used to detect mode changes (e.g. create → mock) and offer resource cleanup |
| `CLEANUP_AI` | `keep` or `delete` — what to do with MS Foundry resources when switching away from create mode |
| `CLEANUP_FRONTEND` | `yes` or `no` — whether to remove frontend pods when narrowing scope |
| `CLEANUP_BACKEND` | `yes` or `no` — whether to remove backend pods when narrowing scope |
| `AUTO_YES` | One-shot flag — wizard creates temp file `/tmp/.azd-auto-deploy-<env>`, deploy.sh reads and deletes it |

## Quick Recipes

**Recipe mode (recommended):**
```bash
azd init
azd env set RECIPE all    # full stack + MS Foundry
azd up
```

**Dev/test recipe:**
```bash
azd init
azd env set RECIPE dev    # mock AI, cheapest VM
azd up
```

**Custom wizard:**
```bash
azd init
azd up    # no RECIPE = interactive wizard handles everything
```

**CI/Automation (recipe):**
```bash
azd env new my-chat
azd env set RECIPE all
azd up -- -y
```

**Upgrade mock → MS Foundry:**
```bash
azd env set AI_PROJECT_ENDPOINT "https://..."
azd env set AI_AGENT_ID "<agent>:<version>"
azd env set AI_RESOURCE_GROUP "<rg>"
./hooks/connect-foundry.sh -y
```

**Resume from any machine:**
```bash
azd env new <existing-prefix>
azd env set AZURE_SUBSCRIPTION_ID <sub-id>
azd up    # auto-detects config from Azure resources + RG tags
```

---

*Last updated: 2026-03-05 | Last commit: cb3b21b*
