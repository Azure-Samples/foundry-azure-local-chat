# Resource Cleanup on Configuration Changes

## Overview

When users change configuration between `azd up` runs, some previously-created resources may become unused. Instead of silently keeping (billing) or silently deleting (data loss), we **detect the change and ask**.

---

## Detection

Track previous values in azd env:

```
PREV_AI_MODE=create
PREV_DEPLOY_SCOPE=all
```

On each run, compare current selections against `PREV_*` values. If they differ, trigger the appropriate cleanup prompt.

---

## Scenarios

### 1. AI Mode: `create` → `mock` or `byo`

**What's affected:**
- AI Services account (hub) — ~$0/month base but model deployment bills per TPM
- AI project — no direct cost
- Model deployment — bills for reserved TPM capacity

**Prompt:**
```
⚠️  You previously created MS Foundry resources.
    These may still incur charges (model deployment TPM).

    What would you like to do?
    ❯ Delete AI resources — remove hub, project, and model
      Keep them — I might switch back later
```

**If delete:**
```bash
az cognitiveservices account delete \
  --name "${PREFIX}-ai-hub" \
  --resource-group "${PREFIX}-rg"
```

**Note:** This triggers soft-delete (48h). If they want to recreate with same name, they'll need to purge first:
```bash
az cognitiveservices account purge \
  --name "${PREFIX}-ai-hub" \
  --resource-group "${PREFIX}-rg" \
  --location "$LOCATION"
```

**Risk level:** Low. AI resources are stateless in our use case (no fine-tuned models, no stored data).

---

### 2. Deploy Scope: `all` → `backend`

**What's affected:**
- Frontend K8s deployment (pods, service)
- Frontend container image in ACR (small storage cost)
- TLS certificate secret

**Prompt:**
```
⚠️  Frontend is currently deployed on the cluster.

    ❯ Remove frontend — delete pods and service (saves resources)
      Keep it running — leave as-is
```

**If remove:**
```bash
kubectl delete deployment/${PREFIX}-frontend -n $NAMESPACE --ignore-not-found
kubectl delete service/${PREFIX}-frontend -n $NAMESPACE --ignore-not-found
```

**Risk level:** Very low. Frontend is stateless. Can be redeployed instantly.

---

### 3. Deploy Scope: `all` → `frontend`

**What's affected:**
- Backend K8s deployment (pods, service)
- Backend container image in ACR
- Workload Identity service account (keep — used for auth)

**Prompt:**
```
⚠️  Backend is currently deployed on the cluster.

    ❯ Remove backend — delete pods and service
      Keep it running — leave as-is
```

**If remove:**
```bash
kubectl delete deployment/${PREFIX}-server -n $NAMESPACE --ignore-not-found
kubectl delete service/${PREFIX}-server -n $NAMESPACE --ignore-not-found
```

**Risk level:** Low. Backend is stateless (conversations stored in MS Foundry, not locally).

---

### 4. Deploy Scope: `backend` → `frontend` or vice versa

Same as above — prompt to remove the component being dropped.

---

### 5. AI Mode: `mock` → `create`

**No cleanup needed.** This is additive — new AI resources are created.

---

### 6. AI Mode: `byo` → `create`

**No cleanup needed.** RBAC assignments on the external RG are harmless. New AI resources are created in our RG.

---

### 7. Model change (e.g. `gpt-4o-mini` → `gpt-4o`)

**What's affected:**
- Old model deployment still exists in the AI hub
- New model deployment will be created

**Prompt:**
```
⚠️  Changing model from gpt-4o-mini to gpt-4o.
    The old deployment will be replaced.
```

**No user action needed** — Bicep handles this as an update to the deployment resource (same deployment name = update, different name = new + orphan).

**Current behavior:** Our deployment name is `${prefix}-${modelName}`, so changing model creates a NEW deployment and orphans the old one. We should either:
- Use a fixed deployment name (e.g. `${prefix}-chat-model`) so it updates in-place, OR
- Delete the old deployment when model changes

**Recommendation:** Use fixed deployment name `${prefix}-chat` so model changes are in-place updates.

---

## Implementation Plan

### Where to add (script locations)

| Logic | File | When |
|-------|------|------|
| Save `PREV_*` values | `hooks/postprovision.sh` | After successful provision |
| Detect changes | `hooks/preprovision.sh` wizard steps | When user selects different value |
| Show cleanup prompts | `hooks/preprovision.sh` wizard steps | Inline after change detected |
| Execute K8s cleanup | `infra/modes/k8s/deploy.sh` | Before deploying new scope |
| Execute AI cleanup | `hooks/postprovision.sh` | After Bicep runs (or before) |

### New env vars

```
PREV_AI_MODE=create          # saved after successful provision
PREV_DEPLOY_SCOPE=all        # saved after successful provision  
PREV_AI_MODEL_NAME=gpt-4o-mini  # saved after successful provision
```

### Flow

```
azd up
  → preprovision.sh
    → wizard runs
    → user changes AI_MODE from "create" to "mock"
    → detect: PREV_AI_MODE=create, new=mock → show cleanup prompt
    → user picks "Delete AI resources"
    → save CLEANUP_AI=true
  → provision (Bicep skips AI resources since aiMode=mock)
  → postprovision.sh
    → if CLEANUP_AI=true: delete AI hub
    → save PREV_AI_MODE=mock
  → deploy.sh
    → deploys as usual
```

---

## What NOT to auto-delete

| Resource | Why keep |
|----------|---------|
| **ACR images** | Tiny cost, useful for rollback |
| **AKS cluster** | Always needed regardless of scope |
| **Workload Identity** | Always needed for backend auth |
| **Ingress / TLS cert** | Reusable, no cost |
| **Namespace** | No cost, keeps things organized |

---

## Summary

| Change | Detect | Prompt | Action |
|--------|--------|--------|--------|
| AI `create` → `mock`/`byo` | ✅ | "Delete AI resources?" | `az cognitiveservices account delete` |
| Scope `all` → `backend` | ✅ | "Remove frontend?" | `kubectl delete deployment/frontend` |
| Scope `all` → `frontend` | ✅ | "Remove backend?" | `kubectl delete deployment/backend` |
| Model change | ✅ | Inform only | Use fixed deployment name for in-place update |
| Anything additive | ✅ | No prompt | Just deploy |

---

*Last updated: 2026-03-04*
