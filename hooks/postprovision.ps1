# Copyright (c) Microsoft Corporation.
# Licensed under the MIT License.
# ═══════════════════════════════════════════════════════════════
# postprovision.ps1 — Post-provision hook (PowerShell)
# ═══════════════════════════════════════════════════════════════
# Runs after `azd provision` completes. Handles:
#   1. AI Mode "create" — store endpoint + create agent via SDK
#   2. RBAC assignment for AI resources (create & byo modes)
#   3. AI cleanup if user switched away from "create" mode
#   4. Save current config as PREV for change detection
# Then delegates to infra/modes/<DEPLOY_MODE>/postprovision.ps1
# ═══════════════════════════════════════════════════════════════

$ErrorActionPreference = "Stop"

$SCRIPT_DIR = $PSScriptRoot
$REPO_ROOT  = (Resolve-Path (Join-Path $SCRIPT_DIR "..")).Path
$INFRA_DIR  = Join-Path $REPO_ROOT "infra"

$ESC = [char]27
$GREEN  = "${ESC}[0;32m"; $CYAN = "${ESC}[0;36m"; $YELLOW = "${ESC}[1;33m"
$RED = "${ESC}[0;31m"; $DIM = "${ESC}[2m"; $NC = "${ESC}[0m"

# ─── Prerequisites ────────────────────────────────────────────
. "$INFRA_DIR\validate.ps1"
Require-Cli "az"
Require-Cli "azd"
Invoke-ValidateOrExit

# Load azd env values
$azdValues = azd env get-values 2>$null | Where-Object { $_ -notmatch '^\s*#' -and $_ -match '=' }
foreach ($line in $azdValues) {
    if ($line -match '^([^=]+)=["'']?(.*)["'']?$') {
        $k = $Matches[1]; $v = $Matches[2].Trim('"').Trim("'")
        Set-Item -Path "env:$k" -Value $v
    }
}

$DEPLOY_MODE   = if ($env:DEPLOY_MODE) { $env:DEPLOY_MODE } else { "k8s" }
$AI_RG         = $env:AI_RESOURCE_GROUP
$PRINCIPAL_ID  = $env:AZURE_WI_PRINCIPAL_ID
$DEPLOY_SCOPE  = if ($env:DEPLOY_SCOPE) { $env:DEPLOY_SCOPE } else { "all" }
$AI_MODE       = if ($env:AI_MODE) { $env:AI_MODE } else { "byo" }
$NEEDS_BACKEND = ($DEPLOY_SCOPE -eq "all" -or $DEPLOY_SCOPE -eq "backend")

# ═══════════════════════════════════════════════════════════════
# AI Mode: create — set endpoint + create agent
# ═══════════════════════════════════════════════════════════════

if ($NEEDS_BACKEND -and $AI_MODE -eq "create") {
    $AI_ENDPOINT = $env:AI_FOUNDRY_ENDPOINT
    if ($AI_ENDPOINT) {
        Write-Host ""
        Write-Host "`u{1F916} AI Mode: create `u{2014} MS Foundry resources provisioned"

        azd env set AI_PROJECT_ENDPOINT "$AI_ENDPOINT" 2>$null
        azd env set DATASOURCES "api" 2>$null
        Write-Host "  `u{2705} AI_PROJECT_ENDPOINT=$AI_ENDPOINT"

        $AGENT_ID_VAL = $env:AI_AGENT_ID
        if (-not $AGENT_ID_VAL) {
            Write-Host ""
            Write-Host "  ${DIM}Waiting 30s for RBAC propagation...${NC}"
            Start-Sleep -Seconds 30

            # Create agent via Node.js SDK
            $env:AI_PROJECT_ENDPOINT = $AI_ENDPOINT
            $env:AI_MODEL_DEPLOYMENT = if ($env:AI_FOUNDRY_MODEL_DEPLOYMENT) { $env:AI_FOUNDRY_MODEL_DEPLOYMENT } else { "$($env:ARC_PREFIX)-chat" }
            $env:AGENT_NAME = "$($env:ARC_PREFIX)-agent"

            try {
                $AGENT_OUTPUT = & node (Join-Path $REPO_ROOT "server\scripts\create-agent.js") 2>&1 | Out-String
                Write-Host $AGENT_OUTPUT
                if ($AGENT_OUTPUT -match "AGENT_ID=(.+)") {
                    $CREATED_ID = $Matches[1].Trim()
                    azd env set AI_AGENT_ID "$CREATED_ID" 2>$null
                    Write-Host "  `u{2705} AI_AGENT_ID=$CREATED_ID"
                } else {
                    Write-Host ""
                    Write-Host "  `u{26A0}`u{FE0F}  Agent creation failed. Create it manually:"
                    Write-Host "     1. Open: https://ai.azure.com"
                    Write-Host "     2. Go to project: $($env:ARC_PREFIX)-ai-project `u{2192} Agents `u{2192} Create"
                    Write-Host "     3. Select model: $($env:AI_MODEL_DEPLOYMENT)"
                    Write-Host "     4. Run: azd env set AI_AGENT_ID `"<agent-name>:<version>`""
                }
            } catch {
                Write-Host ""
                Write-Host "  `u{26A0}`u{FE0F}  Agent creation failed: $_"
            }
        }
    }
}

# ═══════════════════════════════════════════════════════════════
# RBAC assignment for AI resources (create & byo modes)
# ═══════════════════════════════════════════════════════════════

if ($NEEDS_BACKEND -and $PRINCIPAL_ID -and $env:AZURE_SUBSCRIPTION_ID -and $AI_MODE -ne "mock") {
    $RBAC_RG = ""
    if ($AI_MODE -eq "create") {
        $RBAC_RG = "$($env:ARC_PREFIX)-rg"
    } elseif ($AI_RG) {
        $RBAC_RG = $AI_RG
    }

    if ($RBAC_RG) {
        Write-Host ""
        Write-Host "`u{1F511} Assigning AI RBAC roles in RG: $RBAC_RG"
        $RBAC_SCOPE = "/subscriptions/$($env:AZURE_SUBSCRIPTION_ID)/resourceGroups/$RBAC_RG"

        # Cognitive Services User
        az role assignment create `
            --assignee-object-id "$PRINCIPAL_ID" --assignee-principal-type ServicePrincipal `
            --role "a97b65f3-24c7-4388-baec-2e87135dc908" `
            --scope "$RBAC_SCOPE" --output none 2>$null
        # Cognitive Services OpenAI Contributor
        az role assignment create `
            --assignee-object-id "$PRINCIPAL_ID" --assignee-principal-type ServicePrincipal `
            --role "a001fd3d-188f-4b5d-821b-7da978bf7442" `
            --scope "$RBAC_SCOPE" --output none 2>$null
        # Azure AI Developer
        az role assignment create `
            --assignee-object-id "$PRINCIPAL_ID" --assignee-principal-type ServicePrincipal `
            --role "64702f94-c441-49e6-a78b-ef80e0188fee" `
            --scope "$RBAC_SCOPE" --output none 2>$null

        Write-Host "`u{2705} AI RBAC roles assigned"
    }
}

# ═══════════════════════════════════════════════════════════════
# AI cleanup (if user switched away from "create" mode)
# ═══════════════════════════════════════════════════════════════

$CLEANUP_AI = $env:CLEANUP_AI
if ($CLEANUP_AI -eq "delete") {
    Write-Host ""
    Write-Host "`u{1F5D1}`u{FE0F}  Deleting MS Foundry resources..."
    $AI_HUB_NAME = "$($env:ARC_PREFIX)-ai-hub"
    az cognitiveservices account delete `
        --name "$AI_HUB_NAME" `
        --resource-group "$($env:ARC_PREFIX)-rg" `
        --output none 2>$null
    Write-Host "`u{2705} AI hub deleted (soft-delete `u{2014} purges automatically after 48h)"
    azd env set CLEANUP_AI "" 2>$null
}

# ═══════════════════════════════════════════════════════════════
# Save PREV values for change detection on next run
# ═══════════════════════════════════════════════════════════════

azd env set PREV_DEPLOY_SCOPE "$DEPLOY_SCOPE" 2>$null
azd env set PREV_AI_MODE "$AI_MODE" 2>$null
azd env set PROVISION_DONE "true" 2>$null

Write-Host ""
Write-Host "`u{1F4E6} Post-provision mode: $DEPLOY_MODE"
Write-Host ""

# Delegate to mode-specific postprovision script
$MODE_SCRIPT = Join-Path $REPO_ROOT "infra\modes\$DEPLOY_MODE\postprovision.ps1"
if (-not (Test-Path $MODE_SCRIPT)) {
    Write-Host "`u{274C} Unknown DEPLOY_MODE '$DEPLOY_MODE' `u{2014} no script at $MODE_SCRIPT"
    exit 1
}
& $MODE_SCRIPT
