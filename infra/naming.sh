#!/bin/bash
# Copyright (c) Microsoft Corporation.
# Licensed under the MIT License.
# ============================================================
# Shared resource naming helper
# ============================================================
# Derives all resource names from ARC_PREFIX.
# Clamps names to Azure limits, falls back to short names.
# Source this file from hooks/modes: source "$REPO_ROOT/infra/naming.sh"
# ============================================================

_PREFIX="${ARC_PREFIX}"

# Clamp a name: clamp <desired> <suffix> <max_length>
# If prefix+suffix > max, trims prefix and strips trailing hyphens
clamp() {
    local name="$1" max="$2"
    if [ ${#name} -le "$max" ]; then
        echo "$name"
    else
        local trimmed="${name:0:$max}"
        trimmed="${trimmed%-}"  # strip trailing hyphen
        echo "$trimmed"
    fi
}

# Azure resource names
export RES_RESOURCE_GROUP="$(clamp "${_PREFIX}-rg" 90)"
export RES_CLUSTER="$(clamp "${_PREFIX}-cluster" 63)"
export RES_ACR="$(echo "${_PREFIX}acr" | tr -d '-' | head -c 50)"
export RES_ACR_SERVER="${RES_ACR}.azurecr.io"
export RES_NAMESPACE="$(clamp "${_PREFIX}-ns" 63)"
export RES_IDENTITY="$(clamp "${_PREFIX}-backend-id" 128)"
export RES_SA="$(clamp "${_PREFIX}-backend-sa" 253)"

# Container Apps specific (strict limits)
export RES_EXTENSION="containerapp-ext"
export RES_CUSTOM_LOCATION="$(clamp "${_PREFIX}-location" 63)"
export RES_CONNECTED_ENV="$(clamp "${_PREFIX}-env" 60)"
export RES_BACKEND_APP="$(clamp "${_PREFIX}-server" 32)"
export RES_FRONTEND_APP="$(clamp "${_PREFIX}-frontend" 32)"

# If names were truncated (don't end with expected suffix), use shorter suffixes
case "$RES_BACKEND_APP" in *-server) ;; *) RES_BACKEND_APP="$(clamp "${_PREFIX}-srv" 32)" ;; esac
case "$RES_FRONTEND_APP" in *-frontend) ;; *) RES_FRONTEND_APP="$(clamp "${_PREFIX}-fe" 32)" ;; esac

# Print config summary box
# Usage: print_config_summary [full|deploy]
print_config_summary() {
    local LEVEL="${1:-full}"
    local TITLE="${2:-Configuration}"
    local VITE_URL="${VITE_API_URL}"
    local DS="${DATASOURCES:-mock}"
    local ST="${STREAMING:-enabled}"
    local ADMIN="${ENABLE_ADMIN_ROUTES:-false}"
    local CORS="${CORS_ORIGINS}"
    local SCOPE="${DEPLOY_SCOPE:-all}"
    local MODE="${DEPLOY_MODE:-k8s}"
    local AIMODE="${AI_MODE:-byo}"
    local AI_MODEL="${AI_MODEL_NAME:-}"
    local AI_VER="${AI_MODEL_VERSION:-}"
    local AI_CAP="${AI_MODEL_CAPACITY:-}"
    local AI_ENDPOINT="${AI_PROJECT_ENDPOINT:-}"
    local AI_AGENT="${AI_AGENT_ID:-}"

    # Colors
    local CYAN='\033[0;36m'
    local GREEN='\033[0;32m'
    local YELLOW='\033[1;33m'
    local DIM='\033[2m'
    local UNDERLINE='\033[4m'
    local NC='\033[0m'
    local LABEL="${DIM}"
    local VAL="${CYAN}"
    local URL="${UNDERLINE}${GREEN}"
    local BOLD='\033[1m'
    local MAGENTA='\033[0;35m'

    # Get subscription name
    local SUB_NAME
    SUB_NAME=$(az account show --query name -o tsv 2>/dev/null || echo "${AZURE_SUBSCRIPTION_ID}")

    local W=48  # box inner width
    # Print a row with right border, padding to fixed width
    # Usage: row "visible text" "ansi formatted text"
    row() {
        local plain="$1" formatted="$2"
        local pad=$((W - ${#plain}))
        [ "$pad" -lt 0 ] && pad=0
        printf "  │ %b%*s│\n" "$formatted" "$pad" ""
    }

    echo ""
    echo -e "  ${DIM}Workflow:${NC} ${BOLD}${MAGENTA}${TITLE}${NC}"
    echo "  ┌$(printf '─%.0s' $(seq 1 $((W+1))))┐"
    row "Target" "${YELLOW}Target${NC}"
    row "  Prefix:       ${_PREFIX}" "  Prefix:       ${VAL}${_PREFIX}${NC}"
    row "  Subscription: ${SUB_NAME}" "  Subscription: ${VAL}${SUB_NAME}${NC}"
    row "" ""
    if [ "$LEVEL" = "full" ]; then
    # Prefer real Bicep outputs over derived names
    local CLUSTER="${AZURE_AKS_CLUSTER_NAME:-${RES_CLUSTER}}"
    local RG="${AZURE_RESOURCE_GROUP:-${RES_RESOURCE_GROUP}}"
    local NS="${AZURE_NAMESPACE:-${RES_NAMESPACE}}"
    row "Infra" "${YELLOW}Infra${NC}"
    row "  Cluster:      ${CLUSTER}" "  Cluster:      ${VAL}${CLUSTER}${NC}"
    row "  RG:           ${RG}" "  RG:           ${VAL}${RG}${NC}"
    row "  Namespace:    ${NS}" "  Namespace:    ${VAL}${NS}${NC}"
    row "  Mode:         ${MODE}" "  Mode:         ${VAL}${MODE}${NC}"
    row "  Nodes:        ${NODE_COUNT:-2} x ${VM_SIZE:-Standard_D4s_v3}" "  Nodes:        ${VAL}${NODE_COUNT:-2} x ${VM_SIZE:-Standard_D4s_v3}${NC}"
    row "" ""
    fi
    row "Deploy" "${YELLOW}Deploy${NC}"
    row "  Scope:        ${SCOPE}" "  Scope:        ${VAL}${SCOPE}${NC}"
    if [ "$SCOPE" = "frontend" ]; then
    if [ -n "$VITE_URL" ]; then
    row "  API URL:      ${VITE_URL}" "  API URL:      ${URL}${VITE_URL}${NC}"
    else
    row "  API URL:      (not set)" "  API URL:      ${RED}(not set)${NC}"
    fi
    fi
    if [ "$SCOPE" != "frontend" ]; then
    row "  Datasource:   ${DS}" "  Datasource:   ${VAL}${DS}${NC}"
    row "  Streaming:    ${ST}" "  Streaming:    ${VAL}${ST}${NC}"
    row "  Admin:        ${ADMIN}" "  Admin:        ${VAL}${ADMIN}${NC}"
    row "  AI Mode:      ${AIMODE}" "  AI Mode:      ${VAL}${AIMODE}${NC}"
    if [ "$AIMODE" = "create" ]; then
    row "  Model:        ${AI_MODEL} (${AI_VER})" "  Model:        ${VAL}${AI_MODEL}${NC} ${DIM}(${AI_VER})${NC}"
    row "  Capacity:     ${AI_CAP}K TPM" "  Capacity:     ${VAL}${AI_CAP}K TPM${NC}"
    if [ -n "$AI_AGENT" ]; then
    row "  Agent:        ${AI_AGENT}" "  Agent:        ${VAL}${AI_AGENT}${NC}"
    else
    row "  Agent:        (auto-created)" "  Agent:        ${DIM}(auto-created)${NC}"
    fi
    elif [ "$AIMODE" = "byo" ]; then
    local SHORT_EP="${AI_ENDPOINT}"
    [ ${#SHORT_EP} -gt 30 ] && SHORT_EP="${SHORT_EP:0:30}..."
    row "  Endpoint:     ${SHORT_EP}" "  Endpoint:     ${URL}${SHORT_EP}${NC}"
    row "  Agent:        ${AI_AGENT}" "  Agent:        ${VAL}${AI_AGENT}${NC}"
    fi
    if [ -n "$CORS" ] && [ "$CORS" != "*" ] && [ "$CORS" != "auto" ]; then
    row "  CORS:         ${CORS}" "  CORS:         ${URL}${CORS}${NC}"
    elif [ "$CORS" = "*" ]; then
    row "  CORS:         * (all origins)" "  CORS:         ${VAL}*${NC} ${DIM}(all origins)${NC}"
    else
    row "  CORS:         (auto-detect)" "  CORS:         ${DIM}(auto-detect)${NC}"
    fi
    fi
    echo "  └$(printf '─%.0s' $(seq 1 $((W+1))))┘"
    echo ""
}
