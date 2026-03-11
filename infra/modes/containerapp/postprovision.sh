#!/bin/bash
# Copyright (c) Microsoft Corporation.
# Licensed under the MIT License.
# ============================================================
# Post-provision hook — runs after Bicep creates Azure resources
# ============================================================
# Handles what Bicep can't:
#   - Arc connection
#   - Container Apps extension
#   - Custom location + connected environment
#   - K8s Service Account for Workload Identity
# ============================================================

set -e

GREEN='\033[0;32m'; BLUE='\033[0;34m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log_info()    { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warn()    { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error()   { echo -e "${RED}❌ $1${NC}"; }

# Derive names from prefix
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$SCRIPT_DIR/../.."
source "$INFRA_DIR/naming.sh"

# ─── Prerequisites ───────────────────────────────────────────
source "$INFRA_DIR/validate.sh"
require_cli "az"
require_cli "kubectl"
require_env "ARC_PREFIX"         "Resource prefix"
require_env "AZURE_LOCATION"     "Azure region"
require_env "AZURE_WI_CLIENT_ID" "Workload Identity client ID"
require_az_login
require_az_extension "connectedk8s"
require_az_extension "k8s-extension"
require_az_extension "customlocation"
require_az_extension "containerapp"
validate_or_exit

PREFIX="${_PREFIX}"
RESOURCE_GROUP="${RES_RESOURCE_GROUP}"
CLUSTER_NAME="${RES_CLUSTER}"
ACR_NAME="${RES_ACR}"
NAMESPACE="${RES_NAMESPACE}"
WI_CLIENT_ID="${AZURE_WI_CLIENT_ID}"
WI_SA_NAME="${RES_SA}"
LOCATION="${AZURE_LOCATION}"

EXTENSION_NAME="${RES_EXTENSION}"
CUSTOM_LOCATION="${RES_CUSTOM_LOCATION}"
CONNECTED_ENV="${RES_CONNECTED_ENV}"

echo ""
echo "=================================================="
echo "🔧 Post-provision: Arc + Extension + Workload Identity"
echo "=================================================="
echo ""

# ─── 1. Get AKS credentials ─────────────────────────────────
log_info "Getting AKS credentials..."
az aks get-credentials --resource-group "$RESOURCE_GROUP" --name "$CLUSTER_NAME" --admin --overwrite-existing
log_success "kubeconfig configured"

# ─── 2. Arc connection ──────────────────────────────────────
log_info "Checking Arc connection..."
if az connectedk8s show --name "$CLUSTER_NAME" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
    log_success "Already Arc-connected: $CLUSTER_NAME"
else
    log_info "Connecting cluster to Arc..."
    az connectedk8s connect \
        --name "$CLUSTER_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --location "$LOCATION"
    log_success "Arc-connected: $CLUSTER_NAME"
fi

# Enable custom-locations feature
CL_OID="${CUSTOM_LOCATION_OID}"
log_info "Enabling custom-locations feature..."
if [ -n "$CL_OID" ]; then
    az connectedk8s enable-features \
        --name "$CLUSTER_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --custom-locations-oid "$CL_OID" \
        --features cluster-connect custom-locations &>/dev/null &
else
    az connectedk8s enable-features \
        --name "$CLUSTER_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --features cluster-connect custom-locations &>/dev/null &
fi
ENABLE_PID=$!
sleep 60
if kill -0 "$ENABLE_PID" 2>/dev/null; then
    kill "$ENABLE_PID" 2>/dev/null || true
    log_warn "enable-features timed out - may already be enabled"
else
    wait "$ENABLE_PID" 2>/dev/null || true
    log_success "custom-locations enabled"
fi

# ─── 3. Container Apps extension ─────────────────────────────
log_info "Checking Container Apps extension..."
if az k8s-extension show --name "$EXTENSION_NAME" --cluster-name "$CLUSTER_NAME" \
    --resource-group "$RESOURCE_GROUP" --cluster-type connectedClusters &>/dev/null; then
    log_success "Extension exists: $EXTENSION_NAME"
else
    log_info "Installing Container Apps extension (this may take several minutes)..."
    az k8s-extension create \
        --name "$EXTENSION_NAME" \
        --cluster-name "$CLUSTER_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --cluster-type connectedClusters \
        --extension-type 'Microsoft.App.Environment' \
        --release-train stable \
        --auto-upgrade-minor-version true \
        --scope cluster \
        --release-namespace "$NAMESPACE" \
        --configuration-settings \
            "Microsoft.CustomLocation.ServiceAccount=default" \
            "appsNamespace=${NAMESPACE}" \
            "clusterName=${CLUSTER_NAME}" \
            "envoy.annotations.service.beta.kubernetes.io/azure-load-balancer-resource-group=${RESOURCE_GROUP}"
    log_success "Extension installed: $EXTENSION_NAME"
fi

# Wait for extension to be ready (skip if already installed)
STATE=$(az k8s-extension show --name "$EXTENSION_NAME" --cluster-name "$CLUSTER_NAME" \
    --resource-group "$RESOURCE_GROUP" --cluster-type connectedClusters \
    --query installState -o tsv 2>/dev/null || echo "Pending")
PROV_STATE=$(az k8s-extension show --name "$EXTENSION_NAME" --cluster-name "$CLUSTER_NAME" \
    --resource-group "$RESOURCE_GROUP" --cluster-type connectedClusters \
    --query provisioningState -o tsv 2>/dev/null || echo "")
if [ "$STATE" = "Installed" ] || [ "$PROV_STATE" = "Succeeded" ]; then
    log_success "Extension ready"
else
    log_info "Waiting for extension to be ready (state: $STATE, provisioning: $PROV_STATE)..."
    WAIT_COUNT=0
    while true; do
        STATE=$(az k8s-extension show --name "$EXTENSION_NAME" --cluster-name "$CLUSTER_NAME" \
            --resource-group "$RESOURCE_GROUP" --cluster-type connectedClusters \
            --query installState -o tsv 2>/dev/null || echo "Pending")
        PROV_STATE=$(az k8s-extension show --name "$EXTENSION_NAME" --cluster-name "$CLUSTER_NAME" \
            --resource-group "$RESOURCE_GROUP" --cluster-type connectedClusters \
            --query provisioningState -o tsv 2>/dev/null || echo "")
        if [ "$STATE" = "Installed" ] || [ "$PROV_STATE" = "Succeeded" ]; then break; fi
        if [ "$WAIT_COUNT" -ge 60 ]; then
            log_warn "Extension still in state '$STATE' after 10 minutes. Continuing..."
            break
        fi
        sleep 10
        WAIT_COUNT=$((WAIT_COUNT + 1))
    done
    log_success "Extension ready"
fi

# ─── 4. Custom location + connected environment ─────────────
EXTENSION_ID=$(az k8s-extension show --name "$EXTENSION_NAME" --cluster-name "$CLUSTER_NAME" \
    --resource-group "$RESOURCE_GROUP" --cluster-type connectedClusters \
    --query id -o tsv 2>/dev/null)
CONNECTED_CLUSTER_ID=$(az connectedk8s show --name "$CLUSTER_NAME" --resource-group "$RESOURCE_GROUP" \
    --query id -o tsv 2>/dev/null)

if az customlocation show --resource-group "$RESOURCE_GROUP" --name "$CUSTOM_LOCATION" &>/dev/null; then
    log_success "Custom location exists: $CUSTOM_LOCATION"
else
    log_info "Creating custom location: $CUSTOM_LOCATION"
    az customlocation create \
        --resource-group "$RESOURCE_GROUP" \
        --name "$CUSTOM_LOCATION" \
        --host-resource-id "$CONNECTED_CLUSTER_ID" \
        --namespace "$NAMESPACE" \
        --cluster-extension-ids "$EXTENSION_ID" \
        --location "$LOCATION"
    log_success "Custom location created"
fi

CUSTOM_LOCATION_ID=$(az customlocation show --resource-group "$RESOURCE_GROUP" \
    --name "$CUSTOM_LOCATION" --query id -o tsv)

if az containerapp connected-env show --resource-group "$RESOURCE_GROUP" --name "$CONNECTED_ENV" &>/dev/null; then
    log_success "Connected environment exists: $CONNECTED_ENV"
else
    log_info "Creating connected environment: $CONNECTED_ENV"
    az containerapp connected-env create \
        --resource-group "$RESOURCE_GROUP" \
        --name "$CONNECTED_ENV" \
        --custom-location "$CUSTOM_LOCATION_ID" \
        --location "$LOCATION"
    log_success "Connected environment created"
fi

# ─── 5. K8s Service Account for Workload Identity ───────────
log_info "Configuring Kubernetes Service Account..."
kubectl get namespace "$NAMESPACE" &>/dev/null || kubectl create namespace "$NAMESPACE"

if kubectl get serviceaccount "$WI_SA_NAME" -n "$NAMESPACE" &>/dev/null; then
    kubectl annotate serviceaccount "$WI_SA_NAME" -n "$NAMESPACE" \
        "azure.workload.identity/client-id=$WI_CLIENT_ID" --overwrite 2>/dev/null
    log_success "Service Account exists: $WI_SA_NAME"
else
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
    log_success "Service Account created: $WI_SA_NAME"
fi

echo ""
log_success "Post-provision complete!"
echo ""
