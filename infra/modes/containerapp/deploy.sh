#!/bin/bash
# Copyright (c) Microsoft Corporation.
# Licensed under the MIT License.
# ============================================================
# Container Apps mode — deploy (build + create container apps)
# ============================================================

set -e

GREEN='\033[0;32m'; BLUE='\033[0;34m'; YELLOW='\033[1;33m'; NC='\033[0m'
log_info()    { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warn()    { echo -e "${YELLOW}⚠️  $1${NC}"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
INFRA_DIR="$SCRIPT_DIR/../.."

set -a
eval "$(azd env get-values | grep -v '^#')" || { echo "❌ Failed to load azd env values"; exit 1; }
set +a

# Shared library + defaults

set -a
eval "$(azd env get-values | grep -v '^#')"
set +a

# Derive names from prefix
source "$INFRA_DIR/naming.sh"

# ─── Prerequisites ───────────────────────────────────────────
source "$INFRA_DIR/validate.sh"
require_cli "az"
require_cli "kubectl"
require_env "ARC_PREFIX" "Resource prefix"
require_az_login
require_az_extension "containerapp"
require_cli "envsubst"
ensure_cluster_context
validate_or_exit

export PREFIX="${_PREFIX}"
export RESOURCE_GROUP="${RES_RESOURCE_GROUP}"
export ACR_NAME="${RES_ACR}"
export ACR_SERVER="${RES_ACR_SERVER}"
export NAMESPACE="${RES_NAMESPACE}"
export CONNECTED_ENV="${RES_CONNECTED_ENV}"
export BACKEND_APP="${RES_BACKEND_APP}"
export FRONTEND_APP="${RES_FRONTEND_APP}"
export IMAGE_TAG="${IMAGE_TAG:-latest}"
export SCOPE="${DEPLOY_SCOPE:-all}"

echo ""
echo "=================================================="
echo "Container Apps Deploy (scope: $SCOPE)"
echo "=================================================="
echo ""

# ─── 1. Get ACR credentials ─────────────────────────────────
log_info "Getting ACR credentials..."
az acr update --name "$ACR_NAME" --admin-enabled true --output none 2>/dev/null || true
ACR_USER=$(az acr credential show --name "$ACR_NAME" --query username -o tsv 2>/dev/null || echo "")
ACR_PASS=$(az acr credential show --name "$ACR_NAME" --query "passwords[0].value" -o tsv 2>/dev/null || echo "")

if [ -z "$ACR_USER" ] || [ -z "$ACR_PASS" ]; then
    log_info "Admin unavailable. Using ACR token..."
    ACR_USER="arc-pull-token"
    if az acr token show --name "$ACR_USER" --registry "$ACR_NAME" &>/dev/null; then
        ACR_PASS=$(az acr token credential generate --name "$ACR_USER" --registry "$ACR_NAME" \
            --password1 --query "passwords[0].value" -o tsv 2>/dev/null || echo "")
    else
        TOKEN_OUTPUT=$(az acr token create --name "$ACR_USER" --registry "$ACR_NAME" \
            --scope-map _repositories_pull 2>/dev/null || echo "")
        ACR_PASS=$(echo "$TOKEN_OUTPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('credentials',{}).get('passwords',[{}])[0].get('value',''))" 2>/dev/null || echo "")
    fi
fi
log_success "ACR credentials ready (user: $ACR_USER)"

if [ -z "$ACR_PASS" ]; then
    log_warn "ACR credentials empty — pull secrets may not work. Check ACR admin or token config."
fi

# ─── 2. Deploy backend ──────────────────────────────────────
BACKEND_FQDN=""
if [ "$SCOPE" = "all" ] || [ "$SCOPE" = "backend" ]; then
    log_info "Building backend image..."
    az acr build --registry "$ACR_NAME" \
        --image "${PREFIX}-server:${IMAGE_TAG}" \
        --file server/Dockerfile "$REPO_ROOT/server"
    log_success "Backend pushed"

    log_info "Deploying backend: $BACKEND_APP"
    if az containerapp show --name "$BACKEND_APP" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
        log_info "Replacing existing backend..."
        az containerapp delete --name "$BACKEND_APP" --resource-group "$RESOURCE_GROUP" --yes --no-wait --output none 2>/dev/null || true
        WAIT=0
        while az containerapp show --name "$BACKEND_APP" --resource-group "$RESOURCE_GROUP" &>/dev/null; do
            sleep 10; WAIT=$((WAIT+1)); [ "$WAIT" -ge 30 ] && { log_warn "Delete timed out"; break; }
        done
    fi
    az containerapp create \
        --name "$BACKEND_APP" \
        --resource-group "$RESOURCE_GROUP" \
        --environment "$CONNECTED_ENV" \
        --environment-type connected \
        --image "${ACR_SERVER}/${PREFIX}-server:${IMAGE_TAG}" \
        --target-port 3001 --ingress external \
        --registry-server "$ACR_SERVER" --registry-username "$ACR_USER" --registry-password "$ACR_PASS" \
        --cpu 0.5 --memory 1Gi --min-replicas 1 --max-replicas 3
    BACKEND_FQDN=$(az containerapp show --name "$BACKEND_APP" --resource-group "$RESOURCE_GROUP" \
        --query "properties.configuration.ingress.fqdn" -o tsv 2>/dev/null || echo "")
    log_success "Backend: https://${BACKEND_FQDN}"
fi

# ─── 3. Deploy frontend ─────────────────────────────────────
FRONTEND_FQDN=""
if [ "$SCOPE" = "all" ] || [ "$SCOPE" = "frontend" ]; then
    # Determine API URL
    if [ -n "${VITE_API_URL}" ]; then
        FRONTEND_API_URL="${VITE_API_URL}"
    elif [ -n "$BACKEND_FQDN" ]; then
        FRONTEND_API_URL="https://${BACKEND_FQDN}/api"
    else
        BACKEND_FQDN=$(az containerapp show --name "$BACKEND_APP" --resource-group "$RESOURCE_GROUP" \
            --query "properties.configuration.ingress.fqdn" -o tsv 2>/dev/null || echo "")
        [ -n "$BACKEND_FQDN" ] && FRONTEND_API_URL="https://${BACKEND_FQDN}/api"
    fi

    log_info "Building frontend image (API URL: ${FRONTEND_API_URL:-/api})..."
    BUILD_ARGS=""
    [ -n "$FRONTEND_API_URL" ] && BUILD_ARGS="--build-arg VITE_API_URL=${FRONTEND_API_URL}"
    az acr build --registry "$ACR_NAME" \
        --image "${PREFIX}-frontend:${IMAGE_TAG}" \
        $BUILD_ARGS \
        --file Dockerfile "$REPO_ROOT"
    log_success "Frontend pushed"

    log_info "Deploying frontend: $FRONTEND_APP"
    if az containerapp show --name "$FRONTEND_APP" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
        log_info "Replacing existing frontend..."
        az containerapp delete --name "$FRONTEND_APP" --resource-group "$RESOURCE_GROUP" --yes --no-wait --output none 2>/dev/null || true
        WAIT=0
        while az containerapp show --name "$FRONTEND_APP" --resource-group "$RESOURCE_GROUP" &>/dev/null; do
            sleep 10; WAIT=$((WAIT+1)); [ "$WAIT" -ge 30 ] && { log_warn "Delete timed out"; break; }
        done
    fi
    az containerapp create \
        --name "$FRONTEND_APP" \
        --resource-group "$RESOURCE_GROUP" \
        --environment "$CONNECTED_ENV" \
        --environment-type connected \
        --image "${ACR_SERVER}/${PREFIX}-frontend:${IMAGE_TAG}" \
        --target-port 80 --ingress external \
        --registry-server "$ACR_SERVER" --registry-username "$ACR_USER" --registry-password "$ACR_PASS" \
        --cpu 0.25 --memory 0.5Gi --min-replicas 1 --max-replicas 3
    FRONTEND_FQDN=$(az containerapp show --name "$FRONTEND_APP" --resource-group "$RESOURCE_GROUP" \
        --query "properties.configuration.ingress.fqdn" -o tsv 2>/dev/null || echo "")
    log_success "Frontend: https://${FRONTEND_FQDN}"
fi

# ─── 4. Configure backend env vars ──────────────────────────
if [ "$SCOPE" = "all" ] || [ "$SCOPE" = "backend" ]; then
    ENV_ARGS=("NODE_ENV=production" "ENABLE_ADMIN_ROUTES=${ENABLE_ADMIN_ROUTES:-false}")
    [ -n "${DATASOURCES}" ] && ENV_ARGS+=("DATASOURCES=${DATASOURCES}")
    [ -n "${STREAMING}" ] && ENV_ARGS+=("STREAMING=${STREAMING}")
    [ -n "${AI_PROJECT_ENDPOINT}" ] && ENV_ARGS+=("AI_PROJECT_ENDPOINT=${AI_PROJECT_ENDPOINT}")
    [ -n "${AI_AGENT_ID}" ] && ENV_ARGS+=("AI_AGENT_ID=${AI_AGENT_ID}")
    if [ -z "$FRONTEND_FQDN" ]; then
        FRONTEND_FQDN=$(az containerapp show --name "$FRONTEND_APP" --resource-group "$RESOURCE_GROUP" \
            --query "properties.configuration.ingress.fqdn" -o tsv 2>/dev/null || echo "")
    fi
    [ -n "$FRONTEND_FQDN" ] && ENV_ARGS+=("CORS_ORIGINS=https://${FRONTEND_FQDN}")

    log_info "Updating backend env vars (CORS, AI config)..."
    az containerapp update --name "$BACKEND_APP" --resource-group "$RESOURCE_GROUP" \
        --set-env-vars "${ENV_ARGS[@]}" --output none || log_warn "Could not set env vars"
fi

# ─── 5. Patch Workload Identity into backend pod ─────────────
# Container Apps on Arc doesn't support managed identity natively.
# We patch the K8s deployment to use our WI service account and label,
# so the AKS webhook injects the federated token into the pod.
if [ "$SCOPE" = "all" ] || [ "$SCOPE" = "backend" ]; then
    WI_CLIENT_ID="${AZURE_WI_CLIENT_ID}"
    export WI_SA_NAME="${RES_SA}"
    if [ -n "$WI_CLIENT_ID" ]; then
        log_info "Patching Workload Identity into backend deployment..."

        # Find the backend deployment name (revision-based)
        BACKEND_DEPLOY=$(kubectl get deployment -n "$NAMESPACE" -o name 2>/dev/null | grep "$BACKEND_APP" | head -1)
        if [ -n "$BACKEND_DEPLOY" ]; then
            # Ensure the WI service account has correct annotations
            kubectl annotate sa "$WI_SA_NAME" -n "$NAMESPACE" \
                "azure.workload.identity/client-id=$WI_CLIENT_ID" --overwrite 2>/dev/null
            kubectl label sa "$WI_SA_NAME" -n "$NAMESPACE" \
                "azure.workload.identity/use=true" --overwrite 2>/dev/null

            # Patch deployment: set SA + WI pod label
            kubectl patch "$BACKEND_DEPLOY" -n "$NAMESPACE" --type='json' -p="[
                {\"op\": \"add\", \"path\": \"/spec/template/metadata/labels/azure.workload.identity~1use\", \"value\": \"true\"},
                {\"op\": \"replace\", \"path\": \"/spec/template/spec/serviceAccountName\", \"value\": \"$WI_SA_NAME\"}
            ]"

            # Wait for rollout
            kubectl rollout status "$BACKEND_DEPLOY" -n "$NAMESPACE" --timeout=120s
            log_success "Workload Identity patched"

            # Deploy the WI watcher to auto-patch future revisions
            log_info "Deploying WI watcher (auto-patches new revisions)..."
            export BACKEND_APP WI_SA_NAME

            envsubst '${PREFIX} ${NAMESPACE} ${BACKEND_APP} ${WI_SA_NAME}' < "$SCRIPT_DIR/wi-watcher.yaml" | kubectl apply -f -
            log_success "WI watcher deployed"
        else
            log_warn "Could not find backend deployment to patch WI"
        fi
    fi
fi

# ─── Summary ────────────────────────────────────────────────
echo ""
log_success "Deployment complete! (scope: $SCOPE)"
echo ""
if [ "$SCOPE" = "all" ]; then
    echo "  Backend:  https://${BACKEND_FQDN}"
    echo "  Frontend: https://${FRONTEND_FQDN}"
elif [ "$SCOPE" = "frontend" ]; then
    echo "  📋 Frontend: https://${FRONTEND_FQDN}"
    echo "  🔗 Backend:  ${VITE_API_URL}"
    echo ""
    echo "  ⚠  Add this origin to your backend's CORS config:"
    echo ""
    echo "     Option 1: Allow this frontend only"
    echo "       az containerapp update --name ${BACKEND_APP} --resource-group ${RESOURCE_GROUP} \\"
    echo "         --set-env-vars \"CORS_ORIGINS=https://${FRONTEND_FQDN}\""
    echo ""
    echo "     Option 2: Allow all origins (dev)"
    echo "       az containerapp update --name ${BACKEND_APP} --resource-group ${RESOURCE_GROUP} \\"
    echo "         --set-env-vars \"CORS_ORIGINS=*\""
    echo ""
    echo "     Option 3: Azure Portal"
    echo "       Container Apps → ${BACKEND_APP} → Environment variables → CORS_ORIGINS"
elif [ "$SCOPE" = "backend" ]; then
    echo "  Backend:  https://${BACKEND_FQDN}"
fi
echo ""
