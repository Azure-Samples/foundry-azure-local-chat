#!/bin/bash
# Copyright (c) Microsoft Corporation.
# Licensed under the MIT License.
# ============================================================
# Shared defaults — single source of truth for all env vars
# ============================================================
# Sourced by ALL hooks. Works on any bash version. No python.
#
# Detection priority (highest wins):
#   1. Local azd env (user's explicit `azd env set` overrides)
#   2. RG tags (cross-machine state — recipe, scope, AI mode, etc.)
#   3. Azure resources (AKS, ACR, identity — infra detection)
#   4. Hardcoded defaults (fallback for fresh environments)
# ============================================================

# Direct .env file I/O — zero azd CLI calls
# Finds default env from .azure/config.json, reads/writes .env directly
_DEF_ENV_FILE=""
_def_find_env() {
    [ -n "$_DEF_ENV_FILE" ] && return
    # Find .azure/config.json — check CWD, REPO_ROOT, and walk up
    local search_dirs=("." "${REPO_ROOT:-}" "${INFRA_DIR:+${INFRA_DIR}/..}")
    local dir config_path name=""
    for dir in "${search_dirs[@]}"; do
        [ -z "$dir" ] && continue
        config_path="${dir}/.azure/config.json"
        if [ -f "$config_path" ]; then
            name=$(grep '"defaultEnvironment"' "$config_path" 2>/dev/null | sed 's/.*: *"\([^"]*\)".*/\1/' || echo "")
            [ -n "$name" ] && [ -f "${dir}/.azure/${name}/.env" ] && _DEF_ENV_FILE="${dir}/.azure/${name}/.env"
            break
        fi
    done
}

if type get_val &>/dev/null 2>&1; then
    _def_get() { get_val "$1"; }
    _def_set() { save_val "$1" "$2"; }
    _def_flush() { true; }
else
    _def_find_env
    _def_get() {
        if [ -n "$_DEF_ENV_FILE" ]; then
            local val; val=$(grep "^${1}=" "$_DEF_ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2-)
            val="${val#\"}" ; val="${val%\"}"
            echo "$val"
        else
            local v; v=$(azd env get-value "$1" 2>/dev/null) && echo "$v" || echo ""
        fi
    }
    _def_set() {
        if [ -n "$_DEF_ENV_FILE" ]; then
            if grep -q "^${1}=" "$_DEF_ENV_FILE" 2>/dev/null; then
                sed -i.bak "s|^${1}=.*|${1}=\"${2}\"|" "$_DEF_ENV_FILE" && rm -f "${_DEF_ENV_FILE}.bak"
            else
                echo "${1}=\"${2}\"" >> "$_DEF_ENV_FILE"
            fi
        else
            azd env set "$1" "$2" 2>/dev/null || true
        fi
    }
    _def_flush() { true; }
fi

_def_default() { [ -z "$(_def_get "$1")" ] && _def_set "$1" "$2" || true; }

apply_defaults() {
    # ── Resolve prefix from env name ──
    local PREFIX; PREFIX=$(_def_get "ARC_PREFIX")
    local ENV_NAME; ENV_NAME=$(_def_get "AZURE_ENV_NAME")
    if [ -z "$PREFIX" ] && [ -n "$ENV_NAME" ]; then
        _def_set "ARC_PREFIX" "$ENV_NAME"
        PREFIX="$ENV_NAME"
    fi
    [ -n "$PREFIX" ] && _def_set "ARC_NAMESPACE" "${PREFIX}-ns"

    local RG="${PREFIX}-rg"

    # ── Detect from Azure ──
    if [ -n "$PREFIX" ]; then
        # Single az call: get RG tags + location via JMESPath → tsv
        local TAG_TSV; TAG_TSV=$(az group show --name "$RG" \
            --query "[location, tags.\"foundry-chat-recipe\", tags.\"foundry-chat-scope\", tags.\"foundry-chat-datasources\", tags.\"foundry-chat-streaming\", tags.\"foundry-chat-cors\", tags.\"foundry-chat-admin\", tags.\"foundry-chat-agent-id\", tags.\"foundry-chat-deploy-done\"]" \
            -o tsv 2>/dev/null || echo "")

        if [ -n "$TAG_TSV" ]; then
            _def_set "AZURE_RESOURCE_GROUP" "$RG"
            _def_set "PROVISION_DONE" "true"

            # TSV columns: location, recipe, scope, datasources, streaming, cors, admin, agent-id, deploy-done
            local LOC RCP SCP DS STR CRS ADM AGT DDN
            IFS=$'\t' read -r LOC RCP SCP DS STR CRS ADM AGT DDN <<< "$TAG_TSV"
            [ -n "$LOC" ] && [ "$LOC" != "None" ] && _def_default "AZURE_LOCATION" "$LOC"
            [ -n "$RCP" ] && [ "$RCP" != "None" ] && _def_default "RECIPE" "$RCP"
            [ -n "$SCP" ] && [ "$SCP" != "None" ] && _def_default "DEPLOY_SCOPE" "$SCP"
            [ -n "$DS" ]  && [ "$DS" != "None" ]  && _def_default "DATASOURCES" "$DS"
            [ -n "$STR" ] && [ "$STR" != "None" ] && _def_default "STREAMING" "$STR"
            [ -n "$CRS" ] && [ "$CRS" != "None" ] && _def_default "CORS_ORIGINS" "$CRS"
            [ -n "$ADM" ] && [ "$ADM" != "None" ] && _def_default "ENABLE_ADMIN_ROUTES" "$ADM"
            [ -n "$AGT" ] && [ "$AGT" != "None" ] && _def_default "AI_AGENT_ID" "$AGT"
            [ -n "$DDN" ] && [ "$DDN" != "None" ] && _def_default "DEPLOY_DONE" "$DDN"

            # ── Infra detection (sequential az calls with --query -o tsv) ──
            if [ -z "$(_def_get "AZURE_AKS_CLUSTER_NAME")" ]; then
                local AKS_TSV; AKS_TSV=$(az aks show --name "${PREFIX}-cluster" --resource-group "$RG" \
                    --query "[agentPoolProfiles[0].vmSize, agentPoolProfiles[0].count]" \
                    -o tsv 2>/dev/null || echo "")
                if [ -n "$AKS_TSV" ]; then
                    _def_set "AZURE_AKS_CLUSTER_NAME" "${PREFIX}-cluster"
                    local VM NODES
                    IFS=$'\t' read -r VM NODES <<< "$AKS_TSV"
                    [ -n "$VM" ] && _def_set "VM_SIZE" "$VM"
                    [ -n "$NODES" ] && _def_set "NODE_COUNT" "$NODES"
                fi

                local ACR; ACR=$(az acr list --resource-group "$RG" --query "[0].name" -o tsv 2>/dev/null || echo "")
                [ -n "$ACR" ] && _def_set "AZURE_ACR_NAME" "$ACR" && _def_set "AZURE_ACR_SERVER" "${ACR}.azurecr.io"

                local WI_TSV; WI_TSV=$(az identity list --resource-group "$RG" \
                    --query "[0].[clientId, principalId]" -o tsv 2>/dev/null || echo "")
                if [ -n "$WI_TSV" ]; then
                    local CID PID
                    IFS=$'\t' read -r CID PID <<< "$WI_TSV"
                    [ -n "$CID" ] && _def_set "AZURE_WI_CLIENT_ID" "$CID"
                    [ -n "$PID" ] && _def_set "AZURE_WI_PRINCIPAL_ID" "$PID"
                fi
            fi

            # ── AI derivation (detect AI_MODE from hub existence) ──
            local AI_HUB="${PREFIX}-ai-hub"
            if [ -z "$(_def_get "AI_MODE")" ]; then
                if az cognitiveservices account show --name "$AI_HUB" --resource-group "$RG" &>/dev/null; then
                    _def_set "AI_MODE" "create"
                elif [ -n "$(_def_get "AI_PROJECT_ENDPOINT")" ]; then
                    _def_set "AI_MODE" "byo"
                fi
            fi

            # When AI_MODE=create, derive endpoint + model from Azure
            if [ "$(_def_get "AI_MODE")" = "create" ]; then
                local AI_PROJECT="${PREFIX}-ai-project"
                _def_default "AI_PROJECT_ENDPOINT" "https://${AI_HUB}.cognitiveservices.azure.com/api/projects/${AI_PROJECT}"

                if [ -z "$(_def_get "AI_MODEL_NAME")" ]; then
                    local MODEL_TSV; MODEL_TSV=$(az cognitiveservices account deployment list \
                        --name "$AI_HUB" --resource-group "$RG" \
                        --query "[0].[properties.model.name, properties.model.version, sku.capacity]" \
                        -o tsv 2>/dev/null || echo "")
                    if [ -n "$MODEL_TSV" ]; then
                        local M V C
                        IFS=$'\t' read -r M V C <<< "$MODEL_TSV"
                        [ -n "$M" ] && [ "$M" != "None" ] && _def_set "AI_MODEL_NAME" "$M"
                        [ -n "$V" ] && [ "$V" != "None" ] && _def_set "AI_MODEL_VERSION" "$V"
                        [ -n "$C" ] && [ "$C" != "None" ] && _def_set "AI_MODEL_CAPACITY" "$C"
                    fi
                fi
            fi
        fi
    fi

    # ── Hardcoded defaults (fallback for anything still unset) ──
    _def_default "DEPLOY_MODE" "k8s"
    _def_default "DEPLOY_SCOPE" "all"
    _def_default "DATASOURCES" "mock"
    _def_default "STREAMING" "enabled"
    _def_default "ENABLE_ADMIN_ROUTES" "false"
    _def_default "CORS_ORIGINS" "auto"
    _def_default "IMAGE_TAG" "latest"
    _def_default "AI_MODE" "byo"
    _def_default "AI_MODEL_NAME" "gpt-4o-mini"
    _def_default "AI_MODEL_VERSION" "2024-07-18"
    _def_default "AI_MODEL_CAPACITY" "1"
    _def_default "VM_SIZE" "Standard_D2s_v6"
    _def_default "NODE_COUNT" "2"
    _def_default "AZURE_LOCATION" "eastus2"
    _def_default "BACKEND_REPLICAS" "1"
    _def_default "FRONTEND_REPLICAS" "1"
    _def_default "BACKEND_CPU" "250m"
    _def_default "BACKEND_CPU_REQUEST" "50m"
    _def_default "BACKEND_MEMORY" "512Mi"
    _def_default "BACKEND_MEMORY_REQUEST" "256Mi"
    _def_default "FRONTEND_CPU" "100m"
    _def_default "FRONTEND_CPU_REQUEST" "10m"
    _def_default "FRONTEND_MEMORY" "128Mi"
    _def_default "FRONTEND_MEMORY_REQUEST" "64Mi"

    _def_flush
}
