#!/bin/bash
# Copyright (c) Microsoft Corporation.
# Licensed under the MIT License.
# ============================================================
# Connect an existing deployment to Azure AI Foundry
# ============================================================
# Use this to switch from mock → api mode without re-provisioning.
# Assigns RBAC roles and redeploys with API settings.
#
# Usage:
#   ./scripts/connect-foundry.sh
#   ./scripts/connect-foundry.sh -y   # skip confirmation
# ============================================================

set -e

GREEN='\033[0;32m'; BLUE='\033[0;34m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log_info()    { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warn()    { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error()   { echo -e "${RED}❌ $1${NC}"; }

AUTO_YES="${AUTO_YES:-false}"
for arg in "$@"; do
    [[ "$arg" == "-y" || "$arg" == "--yes" ]] && AUTO_YES=true
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

source "$REPO_ROOT/infra/validate.sh"
require_cli "az"
require_cli "azd"
require_az_login
validate_or_exit

eval "$(azd env get-values | grep -v '^#')" || { log_error "Failed to load azd env values"; exit 1; }
export ARC_PREFIX="${ARC_PREFIX}"
source "$REPO_ROOT/infra/naming.sh" 2>/dev/null || true

# ─── Validate required vars ─────────────────────────────────
MISSING=false

if [ -z "$AI_PROJECT_ENDPOINT" ]; then
    log_error "AI_PROJECT_ENDPOINT not set"
    echo "  azd env set AI_PROJECT_ENDPOINT \"https://<name>.cognitiveservices.azure.com/api/projects/<project>\""
    MISSING=true
fi

if [ -z "$AI_AGENT_ID" ]; then
    log_error "AI_AGENT_ID not set"
    echo "  azd env set AI_AGENT_ID \"<agent-name>:<version>\""
    MISSING=true
fi

if [ -z "$AI_RESOURCE_GROUP" ]; then
    log_warn "AI_RESOURCE_GROUP not set — trying to auto-detect..."
    # Extract account name from endpoint
    ACCOUNT_NAME=$(echo "$AI_PROJECT_ENDPOINT" | sed -n 's|https://\([^.]*\)\..*|\1|p')
    if [ -n "$ACCOUNT_NAME" ]; then
        AI_RESOURCE_GROUP=$(az cognitiveservices account list \
            --query "[?name=='$ACCOUNT_NAME'].resourceGroup" -o tsv 2>/dev/null || echo "")
    fi
    if [ -n "$AI_RESOURCE_GROUP" ]; then
        azd env set AI_RESOURCE_GROUP "$AI_RESOURCE_GROUP" 2>/dev/null
        log_success "Auto-detected AI_RESOURCE_GROUP=$AI_RESOURCE_GROUP"
    else
        log_error "Could not detect AI_RESOURCE_GROUP"
        echo "  azd env set AI_RESOURCE_GROUP \"<rg-containing-ai-foundry>\""
        MISSING=true
    fi
fi

[ "$MISSING" = "true" ] && exit 1

PRINCIPAL_ID="${AZURE_WI_PRINCIPAL_ID:-}"
if [ -z "$PRINCIPAL_ID" ]; then
    log_error "AZURE_WI_PRINCIPAL_ID not found — run 'azd provision' first to create the managed identity"
    exit 1
fi

# ─── Summary ────────────────────────────────────────────────
print_config_summary deploy "Connect Foundry"

echo "  🔗 AI Foundry"
echo "    Endpoint:  $AI_PROJECT_ENDPOINT"
echo "    Agent:     $AI_AGENT_ID"
echo "    AI RG:     $AI_RESOURCE_GROUP"
echo "    Identity:  ${PRINCIPAL_ID:0:8}..."
echo ""
echo "  Steps:"
echo "    1. Assign RBAC roles on AI Foundry resource group"
echo "    2. Set DATASOURCES=api"
echo "    3. Redeploy backend"
echo ""

if [ "$AUTO_YES" != "true" ]; then
    read -p "  Continue? [Y/n]: " CONFIRM
    if [[ "$CONFIRM" =~ ^[Nn]$ ]]; then
        echo "  Cancelled."
        exit 0
    fi
fi

# ─── 1. Assign RBAC ─────────────────────────────────────────
log_info "Assigning RBAC roles on $AI_RESOURCE_GROUP..."
SCOPE="/subscriptions/${AZURE_SUBSCRIPTION_ID}/resourceGroups/${AI_RESOURCE_GROUP}"

az role assignment create \
    --assignee-object-id "$PRINCIPAL_ID" --assignee-principal-type ServicePrincipal \
    --role "a97b65f3-24c7-4388-baec-2e87135dc908" \
    --scope "$SCOPE" --output none 2>/dev/null || true

az role assignment create \
    --assignee-object-id "$PRINCIPAL_ID" --assignee-principal-type ServicePrincipal \
    --role "a001fd3d-188f-4b5d-821b-7da978bf7442" \
    --scope "$SCOPE" --output none 2>/dev/null || true

az role assignment create \
    --assignee-object-id "$PRINCIPAL_ID" --assignee-principal-type ServicePrincipal \
    --role "64702f94-c441-49e6-a78b-ef80e0188fee" \
    --scope "$SCOPE" --output none 2>/dev/null || true

log_success "RBAC roles assigned (Cognitive Services User + OpenAI Contributor + Azure AI Developer)"

# ─── 2. Update azd env ──────────────────────────────────────
azd env set DATASOURCES "api" 2>/dev/null
log_success "DATASOURCES set to 'api'"

# ─── 3. Redeploy backend ────────────────────────────────────
log_info "Redeploying backend with API settings..."
log_info "Waiting 30s for RBAC propagation..."
sleep 30

export AUTO_YES=true
exec "$REPO_ROOT/hooks/deploy.sh" -y
