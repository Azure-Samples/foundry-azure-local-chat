#!/bin/bash
# Copyright (c) Microsoft Corporation.
# Licensed under the MIT License.
# ═══════════════════════════════════════════════════════════════
# postprovision.sh — Post-provision hook
# ═══════════════════════════════════════════════════════════════
# Runs after `azd provision` completes. Handles:
#   1. AI Mode "create" — store endpoint + create agent via SDK
#   2. RBAC assignment for AI resources (create & byo modes)
#   3. AI cleanup if user switched away from "create" mode
#   4. Save current config as PREV for change detection
# Then delegates to infra/modes/<DEPLOY_MODE>/postprovision.sh
# ═══════════════════════════════════════════════════════════════

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ─── Prerequisites ────────────────────────────────────────────

source "$REPO_ROOT/infra/validate.sh"
require_cli "az"
require_cli "azd"
validate_or_exit

eval "$(azd env get-values | grep -v '^#')" || { echo "❌ Failed to load azd env values"; exit 1; }
DEPLOY_MODE="${DEPLOY_MODE:-k8s}"

# ─── Cross-RG RBAC note ──────────────────────────────────────
# Bicep scoping into an external RG causes azd down to try to
# delete everything in that RG. Using az CLI keeps it invisible
# to azd's resource tracking.
AI_RG="${AI_RESOURCE_GROUP:-}"
PRINCIPAL_ID="${AZURE_WI_PRINCIPAL_ID:-}"
DEPLOY_SCOPE="${DEPLOY_SCOPE:-all}"
AI_MODE="${AI_MODE:-byo}"
NEEDS_BACKEND=false
[ "$DEPLOY_SCOPE" = "all" ] || [ "$DEPLOY_SCOPE" = "backend" ] && NEEDS_BACKEND=true

# ═══════════════════════════════════════════════════════════════
# AI Mode: create — set endpoint + create agent
# ═══════════════════════════════════════════════════════════════

if [ "$NEEDS_BACKEND" = "true" ] && [ "$AI_MODE" = "create" ]; then
    AI_ENDPOINT="${AI_FOUNDRY_ENDPOINT:-}"
    if [ -n "$AI_ENDPOINT" ]; then
        echo ""
        echo "🤖 AI Mode: create — AI Foundry resources provisioned"

        azd env set AI_PROJECT_ENDPOINT "$AI_ENDPOINT" 2>/dev/null || true
        azd env set DATASOURCES "api" 2>/dev/null || true
        echo "  ✅ AI_PROJECT_ENDPOINT=$AI_ENDPOINT"

        # Create agent via Node.js SDK (same SDK the app uses)
        AGENT_ID_VAL="${AI_AGENT_ID:-}"
        if [ -z "$AGENT_ID_VAL" ]; then
            echo ""
            echo -e "  ${DIM:-}Waiting 30s for RBAC propagation...${NC:-}"
            sleep 30

            # ─── Create agent via Node.js SDK ────────────────────
            export AI_PROJECT_ENDPOINT="$AI_ENDPOINT"
            export AI_MODEL_DEPLOYMENT="${AI_FOUNDRY_MODEL_DEPLOYMENT:-${ARC_PREFIX}-chat}"
            export AGENT_NAME="${ARC_PREFIX}-agent"

            # Install deps and run from server dir (has @azure/ai-projects)
            AGENT_OUTPUT=$(cd "$REPO_ROOT/server" && node scripts/create-agent.js 2>&1) || true
            echo "$AGENT_OUTPUT"
            CREATED_ID=$(echo "$AGENT_OUTPUT" | grep "AGENT_ID=" | sed 's/.*AGENT_ID=//')
            if [ -n "$CREATED_ID" ]; then
                azd env set AI_AGENT_ID "$CREATED_ID" 2>/dev/null || true
                echo "  ✅ AI_AGENT_ID=$CREATED_ID"
            else
                echo ""
                echo "  ⚠️  Agent creation failed. Create it manually:"
                echo "     1. Open: https://ai.azure.com"
                echo "     2. Go to project: ${ARC_PREFIX}-ai-project → Agents → Create"
                echo "     3. Select model: ${AI_MODEL_DEPLOYMENT}"
                echo "     4. Run: azd env set AI_AGENT_ID \"<agent-name>:<version>\""
            fi
        fi
    fi
fi

# ═══════════════════════════════════════════════════════════════
# RBAC assignment for AI resources (create & byo modes)
# ═══════════════════════════════════════════════════════════════

if [ "$NEEDS_BACKEND" = "true" ] && [ -n "$PRINCIPAL_ID" ] && [ -n "$AZURE_SUBSCRIPTION_ID" ] && [ "$AI_MODE" != "mock" ]; then
    # Determine the target RG for RBAC
    RBAC_RG=""
    if [ "$AI_MODE" = "create" ]; then
        RBAC_RG="${ARC_PREFIX}-rg"
    elif [ -n "$AI_RG" ]; then
        RBAC_RG="$AI_RG"
    fi

    if [ -n "$RBAC_RG" ]; then
        echo ""
        echo "🔑 Assigning AI RBAC roles in RG: $RBAC_RG"
        RBAC_SCOPE="/subscriptions/${AZURE_SUBSCRIPTION_ID}/resourceGroups/${RBAC_RG}"

        # ─── Cognitive Services User ─────────────────────────
        az role assignment create \
            --assignee-object-id "$PRINCIPAL_ID" --assignee-principal-type ServicePrincipal \
            --role "a97b65f3-24c7-4388-baec-2e87135dc908" \
            --scope "$RBAC_SCOPE" --output none 2>/dev/null || true

        # ─── Cognitive Services OpenAI Contributor ────────────
        az role assignment create \
            --assignee-object-id "$PRINCIPAL_ID" --assignee-principal-type ServicePrincipal \
            --role "a001fd3d-188f-4b5d-821b-7da978bf7442" \
            --scope "$RBAC_SCOPE" --output none 2>/dev/null || true

        # ─── Azure AI Developer ───────────────────────────────
        az role assignment create \
            --assignee-object-id "$PRINCIPAL_ID" --assignee-principal-type ServicePrincipal \
            --role "64702f94-c441-49e6-a78b-ef80e0188fee" \
            --scope "$RBAC_SCOPE" --output none 2>/dev/null || true

        echo "✅ AI RBAC roles assigned"
    fi
fi

# ═══════════════════════════════════════════════════════════════
# AI cleanup (if user switched away from "create" mode)
# ═══════════════════════════════════════════════════════════════

CLEANUP_AI="${CLEANUP_AI:-}"
if [ "$CLEANUP_AI" = "delete" ]; then
    echo ""
    echo "🗑️  Deleting AI Foundry resources..."
    AI_HUB_NAME="${ARC_PREFIX}-ai-hub"
    az cognitiveservices account delete \
        --name "$AI_HUB_NAME" \
        --resource-group "${ARC_PREFIX}-rg" \
        --output none 2>/dev/null || true
    echo "✅ AI hub deleted (soft-delete — purges automatically after 48h)"
    azd env set CLEANUP_AI "" 2>/dev/null || true  # clear flag
fi

# ═══════════════════════════════════════════════════════════════
# Save PREV values for change detection on next run
# ═══════════════════════════════════════════════════════════════

azd env set PREV_DEPLOY_SCOPE "${DEPLOY_SCOPE}" 2>/dev/null || true
azd env set PREV_AI_MODE "${AI_MODE}" 2>/dev/null || true
azd env set PROVISION_DONE "true" 2>/dev/null || true

echo ""
echo "📦 Post-provision mode: $DEPLOY_MODE"
echo ""

exec "$REPO_ROOT/infra/modes/${DEPLOY_MODE}/postprovision.sh"
