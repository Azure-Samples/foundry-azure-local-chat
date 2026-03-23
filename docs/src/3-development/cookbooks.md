---
order: 2
---

# Cookbooks

Copy-paste recipes for common deployment scenarios using `azd` environments and the recipe system.

> **Key concept:** The environment name IS the resource prefix. `azd env new my-chat` creates `my-chat-rg`, `my-chat-cluster`, etc. You never set `ARC_PREFIX` manually.

## Quick Deploy (Recipe: all)

Full stack + MS Foundry with sensible defaults (gpt-4o-mini, D2s_v3, 2 nodes):

```bash
# From the project directory:
azd env set RECIPE all
azd up
# azd prompts for subscription + location, recipe handles everything else

# Or from scratch (clone + deploy):
azd init --template https://github.com/Azure-Samples/foundry-azure-local-chat
azd env set RECIPE all
azd up
```

## Dev/Test (Recipe: dev)

Full stack + mock AI on the cheapest VM (B2s, admin routes enabled, CORS=*):

```bash
azd env set RECIPE dev
azd up
```

## Custom Wizard

Run `azd up` without setting `RECIPE` to walk through the interactive wizard with arrow-key navigation:

```bash
azd up    # wizard prompts for region, VM size, AI mode, deploy scope, etc.
```

## BYO MS Foundry

Use the wizard and select `byo` when prompted for AI mode:

```bash
azd up    # select "byo" in AI mode step, enter your MS Foundry details
```

## Frontend Only (BYOB)

Use the wizard and select `frontend` scope:

```bash
azd up    # select "frontend" in deploy scope, enter your backend URL
```

## CI/Automation

Use a recipe with the `-y` flag to skip all prompts:

```bash
azd env new my-chat
azd env set RECIPE all
azd up -- -y
```

Or set individual vars for full control (see [Advanced: Manual Env Vars](#advanced-manual-env-vars)).

## Managing Environments

`azd` supports multiple environments - use separate environments for each deployment mode or cluster. Each environment has its own set of variables and Bicep outputs.

```bash
# Create environments
azd env new k8s
azd env new containerapp

# Switch between them
azd env select k8s
azd env select containerapp

# List all environments
azd env list

# View current environment config
azd env get-values
```

## Connect Existing Cluster to MS Foundry

Already running with mock mode? Switch to MS Foundry without re-provisioning:

```bash
# Set MS Foundry details
azd env set AI_PROJECT_ENDPOINT "https://<name>.cognitiveservices.azure.com/api/projects/<project>"
azd env set AI_AGENT_ID "<agent-name>:<version>"
azd env set AI_RESOURCE_GROUP "<rg-containing-ai-foundry>"

# Connect (assigns RBAC + sets DATASOURCES=api + redeploys)
./hooks/connect-foundry.sh -y
```

This is a standalone operation - no Bicep, no cluster re-provisioning. It assigns RBAC roles on the MS Foundry resource group and redeploys the backend with API settings.

To switch back to mock:
```bash
azd env set DATASOURCES "mock"
./hooks/deploy.sh -y
```

## Resume Existing Deployment

On a new machine (or fresh clone), resume an existing deployment with just the prefix and subscription:

```bash
git clone <repo-url> && cd foundry-azure-local-chat
azd env new <existing-prefix>                     # must match original env name
azd env set AZURE_SUBSCRIPTION_ID <sub-id>
azd up
```

`infra/defaults.sh` auto-detects from Azure (AKS, ACR, identity, AI hub) and reads deployment config from RG tags (scope, streaming, CORS, agent-id, etc.). `AI_MODE` is derived from hub existence — no tag needed. No need to re-set any other env vars.

> **How it works:** `apply_defaults()` uses the prefix to find the resource group (`<prefix>-rg`), queries AKS for VM size/nodes/location, reads ACR and identity, reads config from RG tags (including agent-id), and derives AI_MODE from hub existence. Local `azd env set` values always take priority over tags. Sets `PROVISION_DONE=true` so the wizard shows Deploy/Modify instead of the full setup flow.

## Common Operations

**Redeploy after code changes:**
```bash
azd up                  # full wizard — modify settings + provision + deploy
./hooks/deploy.sh       # fast redeploy — current settings, no provision
./hooks/deploy.sh -y    # instant redeploy, skip confirmation
```

**Tear down:**
```bash
azd down --force --purge
```

**Dry-run test (validate all deployment scenarios without Azure):**
```bash
bash scripts/test-deploy-matrix.sh           # 35 tests: config, manifests, transitions, CWD, cross-RG
bash scripts/test-deploy-matrix.sh --verbose  # show cleanup prompts that would fire
```

**Switch environments:**
```bash
azd env list                    # see all environments
azd env select k8s              # switch to k8s
azd env select containerapp     # switch to containerapp
azd env get-values              # view current config
```

## Viewing Kubernetes Resources in Azure Portal

The Azure Portal requires a bearer token to display cluster resources. A helper script generates the token and copies it to your clipboard:

```bash
./scripts/portal-token.sh
```

Then in the Portal:
1. Navigate to your AKS cluster, then **Kubernetes resources** (e.g. Workloads, Services)
2. Click **"Sign in"** when prompted
3. Select **"Token"** and paste the copied token

The token is valid for 48 hours. The script auto-installs `kubelogin` if missing and reads cluster info from `azd env`.

## Troubleshooting

### WI Watcher Not Running (Container Apps)

If your Container Apps backend returns 500 errors with `DefaultAzureCredential` failures, the WI watcher may not be running. This typically happens when Azure Policy (Gatekeeper) blocks the watcher's container image.

**Symptoms:**
- Backend returns `{"error":{"code":"server_error","message":"Failed to generate response"}}`
- Container logs show `CredentialUnavailableError` from `DefaultAzureCredential`
- Watcher pod shows `FailedCreate` or `ImagePullBackOff`

**Diagnose:**
```bash
# Check if watcher is running
kubectl get pods -n <namespace> | grep watcher

# Check watcher events for image pull errors
kubectl describe deployment <prefix>-wi-watcher -n <namespace> | tail -20

# Check if WI is patched on the backend
kubectl get deployment -n <namespace> -l containerapps.io/app-name=<prefix>-server \
  -o jsonpath='{.items[0].spec.template.spec.serviceAccountName}'
# Should show: <prefix>-backend-sa (NOT app-<prefix>-server--*)
```

**Fix:**
```bash
# Redeploy (handles everything automatically)
./hooks/deploy.sh
```

**Quick manual WI patch** (if watcher is down and you need it working now):
```bash
# Find the backend deployment
DEPLOY=$(kubectl get deployment -n <namespace> -o name | grep <prefix>-server | head -1)

# Patch WI onto it
kubectl patch $DEPLOY -n <namespace> --type='json' -p='[
  {"op":"add","path":"/spec/template/metadata/labels/azure.workload.identity~1use","value":"true"},
  {"op":"replace","path":"/spec/template/spec/serviceAccountName","value":"<prefix>-backend-sa"}
]'
```

---
*Last updated: 2026-03-05 | Last commit: cb3b21b*
