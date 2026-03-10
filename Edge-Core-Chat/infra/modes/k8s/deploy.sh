#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# deploy.sh — K8s deploy: build images + apply manifests
# ═══════════════════════════════════════════════════════════════
# Builds backend/frontend images via ACR, applies K8s manifests
# with envsubst, waits for ingress IP, and prints access URLs.
# ═══════════════════════════════════════════════════════════════

set -e

GREEN='\033[0;32m'; BLUE='\033[0;34m'; NC='\033[0m'
log_info()    { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
K8S_DIR="$SCRIPT_DIR"
INFRA_DIR="$REPO_ROOT/infra"

# Export all azd env values (envsubst requires exported vars)
set -a
eval "$(azd env get-values | grep -v '^#')" || { echo "❌ Failed to load azd env values"; exit 1; }
set +a

set -a
eval "$(azd env get-values | grep -v '^#')"  # re-load after defaults
set +a

# Derive names from prefix
source "$INFRA_DIR/naming.sh"

# ─── Prerequisites ────────────────────────────────────────────

source "$INFRA_DIR/validate.sh"
require_cli "az"
require_cli "kubectl"
require_cli "envsubst"
require_cli "openssl"
require_env "ARC_PREFIX" "Resource prefix"
require_az_login
ensure_cluster_context
validate_or_exit

export PREFIX="${_PREFIX}"
export ACR_SERVER="${RES_ACR_SERVER}"
export NAMESPACE="${RES_NAMESPACE}"
export WI_CLIENT_ID="${AZURE_WI_CLIENT_ID}"
export WI_SA_NAME="${RES_SA}"
export IMAGE_TAG="${IMAGE_TAG:-latest}"
export BACKEND_PORT="3001"
export FRONTEND_PORT="80"

ACR_NAME="${RES_ACR}"

echo ""
echo "=================================================="
echo "🚀 Deploy: Build + Push + Apply"
echo "=================================================="
echo ""

SCOPE="${DEPLOY_SCOPE:-all}"
log_info "Scope: $SCOPE"

# ═══════════════════════════════════════════════════════════════
# 0. Cleanup unused deployments (from scope change)
# ═══════════════════════════════════════════════════════════════

CLEANUP_FRONTEND="${CLEANUP_FRONTEND:-}"
CLEANUP_BACKEND="${CLEANUP_BACKEND:-}"
if [ "$CLEANUP_FRONTEND" = "yes" ]; then
    log_info "Removing frontend deployment..."
    kubectl delete deployment/${PREFIX}-frontend -n "$NAMESPACE" --ignore-not-found 2>/dev/null || true
    kubectl delete service/${PREFIX}-frontend -n "$NAMESPACE" --ignore-not-found 2>/dev/null || true
    log_success "Frontend removed"
    azd env set CLEANUP_FRONTEND "" 2>/dev/null || true
fi
if [ "$CLEANUP_BACKEND" = "yes" ]; then
    log_info "Removing backend deployment..."
    kubectl delete deployment/${PREFIX}-server -n "$NAMESPACE" --ignore-not-found 2>/dev/null || true
    kubectl delete service/${PREFIX}-server -n "$NAMESPACE" --ignore-not-found 2>/dev/null || true
    log_success "Backend removed"
    azd env set CLEANUP_BACKEND "" 2>/dev/null || true
fi

# ═══════════════════════════════════════════════════════════════
# 1. Deploy backend
# ═══════════════════════════════════════════════════════════════

if [ "$SCOPE" = "all" ] || [ "$SCOPE" = "backend" ]; then
    log_info "Building backend image..."
    az acr build \
        --registry "$ACR_NAME" \
        --image "${PREFIX}-server:${IMAGE_TAG}" \
        --file server/Dockerfile \
        "$REPO_ROOT/server"
    log_success "Backend pushed: ${ACR_SERVER}/${PREFIX}-server:${IMAGE_TAG}"

    log_info "Applying backend + ingress manifests..."
    for FILE in namespace.yaml backend.yaml ingress.yaml; do
        envsubst < "$K8S_DIR/$FILE" | kubectl apply -f -
    done
    kubectl rollout restart deployment/${PREFIX}-server -n "$NAMESPACE"
    kubectl rollout status deployment/${PREFIX}-server -n "$NAMESPACE" --timeout=120s
fi

# ═══════════════════════════════════════════════════════════════
# 2. Wait for ingress IP
# ═══════════════════════════════════════════════════════════════

log_info "Waiting for ingress IP..."
INGRESS_IP=""
WAIT_COUNT=0
while [ -z "$INGRESS_IP" ] && [ "$WAIT_COUNT" -lt 24 ]; do
    INGRESS_IP=$(kubectl get ingress ${PREFIX}-ingress -n "$NAMESPACE" \
        -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
    [ -z "$INGRESS_IP" ] && sleep 5
    WAIT_COUNT=$((WAIT_COUNT + 1))
done

if [ -z "$INGRESS_IP" ]; then
    echo "❌ Ingress IP not assigned after 120s. Check: kubectl get ingress -n $NAMESPACE"
    exit 1
fi

# ─── Set CORS for backend (only when deploying backend) ──────
if [ "$SCOPE" = "all" ] || [ "$SCOPE" = "backend" ]; then
    if [ -n "$INGRESS_IP" ]; then
        if [ -z "${CORS_ORIGINS}" ] || [ "${CORS_ORIGINS}" = "auto" ] || [ "${CORS_ORIGINS}" = "*" ]; then
            export CORS_ORIGINS="https://${INGRESS_IP}"
            log_info "Auto-set CORS_ORIGINS: ${CORS_ORIGINS}"
        fi
        envsubst < "$K8S_DIR/backend.yaml" | kubectl apply -f -
        kubectl rollout restart deployment/${PREFIX}-server -n "$NAMESPACE"
    fi
fi

# ═══════════════════════════════════════════════════════════════
# 3. Deploy frontend
# ═══════════════════════════════════════════════════════════════

if [ "$SCOPE" = "all" ] || [ "$SCOPE" = "frontend" ]; then
    # Auto-detect API URL if not set
    if [ -z "${VITE_API_URL}" ] && [ -n "$INGRESS_IP" ]; then
        export VITE_API_URL="https://${INGRESS_IP}/api"
    fi
    log_info "Building frontend image (API URL: ${VITE_API_URL:-/api})..."
    FRONTEND_BUILD_ARGS=""
    if [ -n "${VITE_API_URL}" ]; then
        FRONTEND_BUILD_ARGS="--build-arg VITE_API_URL=${VITE_API_URL}"
    fi
    az acr build \
        --registry "$ACR_NAME" \
        --image "${PREFIX}-frontend:${IMAGE_TAG}" \
        $FRONTEND_BUILD_ARGS \
        --file Dockerfile \
        "$REPO_ROOT"
    log_success "Frontend pushed: ${ACR_SERVER}/${PREFIX}-frontend:${IMAGE_TAG}"

    # ─── TLS cert ──────────────────────────────────────────────
    if ! kubectl get secret "${PREFIX}-tls" -n "$NAMESPACE" &>/dev/null; then
        log_info "Creating self-signed TLS certificate..."
        TLS_TMPDIR="$(mktemp -d)"
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout "$TLS_TMPDIR/tls.key" -out "$TLS_TMPDIR/tls.crt" \
            -subj "//CN=${PREFIX}" 2>/dev/null
        kubectl create secret tls "${PREFIX}-tls" \
            --cert="$TLS_TMPDIR/tls.crt" --key="$TLS_TMPDIR/tls.key" \
            -n "$NAMESPACE"
        rm -rf "$TLS_TMPDIR"
        log_success "TLS cert created"
    fi

    # Apply namespace + ingress (in case backend wasn't deployed)
    envsubst < "$K8S_DIR/namespace.yaml" | kubectl apply -f -
    envsubst < "$K8S_DIR/ingress.yaml" | kubectl apply -f -
    envsubst < "$K8S_DIR/frontend.yaml" | kubectl apply -f -
    kubectl rollout restart deployment/${PREFIX}-frontend -n "$NAMESPACE"
    kubectl rollout status deployment/${PREFIX}-frontend -n "$NAMESPACE" --timeout=120s
fi

# ═══════════════════════════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════════════════════════

echo ""
log_success "Deployment complete! (scope: $SCOPE)"
echo ""
if [ "$SCOPE" = "all" ]; then
    echo "  🌐 App:      https://${INGRESS_IP}"
    echo "  🖥  Backend:  https://${INGRESS_IP}/health"
    echo "  📋 Frontend: https://${INGRESS_IP}/"
elif [ "$SCOPE" = "frontend" ]; then
    echo "  📋 Frontend: https://${INGRESS_IP}/"
    echo "  🔗 Backend:  ${VITE_API_URL}"
    echo ""
    echo "  ⚠  Add this origin to your backend's CORS config:"
    echo ""
    echo "     Option 1: Allow this frontend only"
    echo "       kubectl set env deployment/${PREFIX}-server -n ${NAMESPACE} CORS_ORIGINS=https://${INGRESS_IP}"
    echo ""
    echo "     Option 2: Allow all origins (dev)"
    echo "       kubectl set env deployment/${PREFIX}-server -n ${NAMESPACE} CORS_ORIGINS=*"
    echo ""
    echo "     Option 3: Azure Portal"
    echo "       AKS cluster → Workloads → ${PREFIX}-server → Environment variables → CORS_ORIGINS"
elif [ "$SCOPE" = "backend" ]; then
    echo "  🖥  Backend:  https://${INGRESS_IP}/health"
fi
echo ""
echo "  Useful commands:"
echo "     kubectl get pods -n $NAMESPACE"
echo "     kubectl logs -f deployment/${PREFIX}-server -n $NAMESPACE"
echo ""

# Track deploy state for resume/modify flow
azd env set DEPLOY_DONE "true" 2>/dev/null || true
azd env set PREV_DEPLOY_SCOPE "$SCOPE" 2>/dev/null || true

# Save config to RG tags for cross-machine resume
# AI_MODE is NOT tagged — derived from hub existence at detection time
# AI_AGENT_ID IS tagged — not derivable without heavy SDK calls
RESOURCE_GROUP="${RES_RESOURCE_GROUP}"
az group update --name "$RESOURCE_GROUP" --tags \
    edge-chat-deploy-done="true" \
    edge-chat-recipe="${RECIPE:-custom}" \
    edge-chat-scope="${SCOPE}" \
    edge-chat-datasources="${DATASOURCES:-mock}" \
    edge-chat-streaming="${STREAMING:-enabled}" \
    edge-chat-cors="${CORS_ORIGINS:-auto}" \
    edge-chat-admin="${ENABLE_ADMIN_ROUTES:-false}" \
    edge-chat-agent-id="${AI_AGENT_ID:-}" \
    --output none 2>/dev/null || true
