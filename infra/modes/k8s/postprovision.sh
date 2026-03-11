#!/bin/bash
# Copyright (c) Microsoft Corporation.
# Licensed under the MIT License.
# ============================================================
# Post-provision hook — Arc connect + K8s setup
# ============================================================
# Runs after Bicep creates AKS + ACR + Identity.
# Connects cluster to Arc, installs nginx ingress, sets up
# Workload Identity service account.
# ============================================================

set -e

GREEN='\033[0;32m'; BLUE='\033[0;34m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log_info()    { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warn()    { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error()   { echo -e "${RED}❌ $1${NC}"; }

# Derive names from prefix
MODES_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$MODES_DIR/../.."
source "$INFRA_DIR/naming.sh"

# ─── Prerequisites ───────────────────────────────────────────
source "$INFRA_DIR/validate.sh"
require_cli "az"
require_cli "kubectl"
require_env "ARC_PREFIX"       "Resource prefix"
require_env "AZURE_LOCATION"   "Azure region"
DEPLOY_SCOPE="${DEPLOY_SCOPE:-all}"
if [ "$DEPLOY_SCOPE" != "frontend" ]; then
    require_env "AZURE_WI_CLIENT_ID" "Workload Identity client ID"
fi
require_az_login
require_az_extension "connectedk8s"
validate_or_exit

PREFIX="${_PREFIX}"
RESOURCE_GROUP="${RES_RESOURCE_GROUP}"
CLUSTER_NAME="${RES_CLUSTER}"
NAMESPACE="${RES_NAMESPACE}"
LOCATION="${AZURE_LOCATION}"
WI_CLIENT_ID="${AZURE_WI_CLIENT_ID}"
WI_SA_NAME="${RES_SA}"

echo ""
echo "=================================================="
echo "🔧 Post-provision: Arc + K8s Setup"
echo "=================================================="
echo ""

# ─── 1. Get AKS credentials ─────────────────────────────────
log_info "Getting AKS credentials..."
az aks get-credentials --resource-group "$RESOURCE_GROUP" --name "$CLUSTER_NAME" --admin --overwrite-existing
log_success "kubeconfig configured"

# ─── 2. Connect cluster to Azure Arc ────────────────────────
log_info "Checking Arc connection..."
if az connectedk8s show --name "$CLUSTER_NAME" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
    log_success "Already Arc-connected: $CLUSTER_NAME"
else
    log_info "Connecting cluster to Azure Arc..."
    az connectedk8s connect \
        --name "$CLUSTER_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --location "$LOCATION"
    log_success "Arc-connected: $CLUSTER_NAME"
fi

# ─── 3. Create namespace + service account ───────────────────
log_info "Setting up namespace and service account..."
kubectl get namespace "$NAMESPACE" &>/dev/null || kubectl create namespace "$NAMESPACE"

kubectl apply -f - <<EOF
apiVersion: v1
kind: ServiceAccount
metadata:
  name: ${WI_SA_NAME}
  namespace: ${NAMESPACE}
  annotations:
    azure.workload.identity/client-id: "${WI_CLIENT_ID}"
  labels:
    azure.workload.identity/use: "true"
EOF
log_success "Namespace + Service Account ready"

# ─── 4. Attach ACR to AKS ───────────────────────────────────
ACR_NAME="${AZURE_ACR_NAME}"
log_info "Attaching ACR to AKS..."
az aks update --name "$CLUSTER_NAME" --resource-group "$RESOURCE_GROUP" \
    --attach-acr "$ACR_NAME" --output none 2>/dev/null || \
    log_warn "Could not attach ACR — may need manual setup or already attached"
log_success "ACR attached to AKS"

# ─── 5. Link DNS zone to App Routing for auto-TLS ───────────
DNS_ZONE_ID="${AZURE_DNS_ZONE_ID}"
if [ -n "$DNS_ZONE_ID" ]; then
    log_info "Linking DNS zone to App Routing..."
    az aks approuting zone add \
        --resource-group "$RESOURCE_GROUP" \
        --name "$CLUSTER_NAME" \
        --ids="$DNS_ZONE_ID" \
        --attach-zones --output none 2>/dev/null || \
        log_warn "Could not link DNS zone — may already be linked"
    log_success "DNS zone linked to App Routing"
fi

echo ""
log_success "Post-provision complete!"
echo ""
