# Copyright (c) Microsoft Corporation.
# Licensed under the MIT License.
# ============================================================
# Shared defaults (PowerShell) — single source of truth
# ============================================================
# Dot-source from hooks. Detection priority (highest wins):
#   1. Local azd env   2. RG tags   3. Azure resources   4. Hardcoded
# ============================================================

# Direct .env file I/O — reuse prompts.ps1 if already loaded
$script:_DEF_ENV_FILE = ""

function _Def-FindEnv {
    if ($script:_DEF_ENV_FILE) { return }
    $searchDirs = @(".", $env:REPO_ROOT)
    if ($env:INFRA_DIR) { $searchDirs += (Split-Path $env:INFRA_DIR -Parent) }
    if ($PSScriptRoot) { $searchDirs += (Split-Path $PSScriptRoot -Parent) }
    foreach ($dir in $searchDirs) {
        if (-not $dir) { continue }
        $configPath = Join-Path $dir ".azure\config.json"
        if (Test-Path $configPath) {
            $content = Get-Content $configPath -Raw -ErrorAction SilentlyContinue
            if ($content -match '"defaultEnvironment"\s*:\s*"([^"]*)"') {
                $name = $Matches[1]
                $envFile = Join-Path $dir ".azure\$name\.env"
                if ($name -and (Test-Path $envFile)) { $script:_DEF_ENV_FILE = $envFile }
            }
            break
        }
    }
}

# Use prompts.ps1 functions if available, otherwise provide local implementations
if (Get-Command 'Get-Val' -ErrorAction SilentlyContinue) {
    function _Def-Get { param([string]$k); Get-Val $k }
    function _Def-Set { param([string]$k, [string]$v); Save-Val $k $v }
} else {
    _Def-FindEnv
    function _Def-Get {
        param([string]$k)
        if ($script:_DEF_ENV_FILE) {
            $lines = Get-Content $script:_DEF_ENV_FILE -ErrorAction SilentlyContinue
            foreach ($line in $lines) {
                if ($line -match "^${k}=(.*)$") {
                    $val = $Matches[1].Trim('"')
                    return $val
                }
            }
            return ""
        } else {
            try { $v = azd env get-value $k 2>$null; return $v } catch { return "" }
        }
    }
    function _Def-Set {
        param([string]$k, [string]$v)
        if ($script:_DEF_ENV_FILE) {
            $lines = Get-Content $script:_DEF_ENV_FILE -ErrorAction SilentlyContinue
            $found = $false
            $newLines = @()
            if ($lines) {
                foreach ($line in $lines) {
                    if ($line -match "^${k}=") {
                        $newLines += "${k}=`"${v}`""
                        $found = $true
                    } else {
                        $newLines += $line
                    }
                }
            }
            if (-not $found) { $newLines += "${k}=`"${v}`"" }
            $newLines | Set-Content $script:_DEF_ENV_FILE -Encoding utf8
        } else {
            try { azd env set $k $v 2>$null } catch {}
        }
    }
}

function _Def-Default {
    param([string]$k, [string]$v)
    $cur = _Def-Get $k
    if (-not $cur) { _Def-Set $k $v }
}

function Apply-Defaults {
    # ── Resolve prefix from env name ──
    $PREFIX = _Def-Get "ARC_PREFIX"
    $ENV_NAME = _Def-Get "AZURE_ENV_NAME"
    if (-not $PREFIX -and $ENV_NAME) {
        _Def-Set "ARC_PREFIX" $ENV_NAME
        $PREFIX = $ENV_NAME
    }
    if ($PREFIX) { _Def-Set "ARC_NAMESPACE" "${PREFIX}-ns" }

    $RG = "${PREFIX}-rg"

    # ── Detect from Azure ──
    if ($PREFIX) {
        $TAG_TSV = $null
        try {
            $TAG_TSV = az group show --name $RG `
                --query "[location, tags.""foundry-chat-recipe"", tags.""foundry-chat-scope"", tags.""foundry-chat-datasources"", tags.""foundry-chat-streaming"", tags.""foundry-chat-cors"", tags.""foundry-chat-admin"", tags.""foundry-chat-agent-id"", tags.""foundry-chat-deploy-done""]" `
                -o tsv 2>$null
        } catch {}

        if ($TAG_TSV) {
            _Def-Set "AZURE_RESOURCE_GROUP" $RG
            _Def-Set "PROVISION_DONE" "true"

            $cols = $TAG_TSV -split "`t"
            $LOC = $cols[0]; $RCP = $cols[1]; $SCP = $cols[2]; $DS = $cols[3]
            $STR = $cols[4]; $CRS = $cols[5]; $ADM = $cols[6]; $AGT = $cols[7]; $DDN = $cols[8]

            if ($LOC -and $LOC -ne "None") { _Def-Default "AZURE_LOCATION" $LOC }
            if ($RCP -and $RCP -ne "None") { _Def-Default "RECIPE" $RCP }
            if ($SCP -and $SCP -ne "None") { _Def-Default "DEPLOY_SCOPE" $SCP }
            if ($DS  -and $DS  -ne "None") { _Def-Default "DATASOURCES" $DS }
            if ($STR -and $STR -ne "None") { _Def-Default "STREAMING" $STR }
            if ($CRS -and $CRS -ne "None") { _Def-Default "CORS_ORIGINS" $CRS }
            if ($ADM -and $ADM -ne "None") { _Def-Default "ENABLE_ADMIN_ROUTES" $ADM }
            if ($AGT -and $AGT -ne "None") { _Def-Default "AI_AGENT_ID" $AGT }
            if ($DDN -and $DDN -ne "None") { _Def-Default "DEPLOY_DONE" $DDN }

            # ── Infra detection ──
            if (-not (_Def-Get "AZURE_AKS_CLUSTER_NAME")) {
                $AKS_TSV = $null
                try {
                    $AKS_TSV = az aks show --name "${PREFIX}-cluster" --resource-group $RG `
                        --query "[agentPoolProfiles[0].vmSize, agentPoolProfiles[0].count]" `
                        -o tsv 2>$null
                } catch {}
                if ($AKS_TSV) {
                    _Def-Set "AZURE_AKS_CLUSTER_NAME" "${PREFIX}-cluster"
                    $aksCols = $AKS_TSV -split "`t"
                    if ($aksCols[0]) { _Def-Set "VM_SIZE" $aksCols[0] }
                    if ($aksCols[1]) { _Def-Set "NODE_COUNT" $aksCols[1] }
                }

                $ACR = $null
                try { $ACR = az acr list --resource-group $RG --query "[0].name" -o tsv 2>$null } catch {}
                if ($ACR) {
                    _Def-Set "AZURE_ACR_NAME" $ACR
                    _Def-Set "AZURE_ACR_SERVER" "${ACR}.azurecr.io"
                }

                $WI_TSV = $null
                try {
                    $WI_TSV = az identity list --resource-group $RG `
                        --query "[0].[clientId, principalId]" -o tsv 2>$null
                } catch {}
                if ($WI_TSV) {
                    $wiCols = $WI_TSV -split "`t"
                    if ($wiCols[0]) { _Def-Set "AZURE_WI_CLIENT_ID" $wiCols[0] }
                    if ($wiCols[1]) { _Def-Set "AZURE_WI_PRINCIPAL_ID" $wiCols[1] }
                }
            }

            # ── AI derivation ──
            $AI_HUB = "${PREFIX}-ai-hub"
            if (-not (_Def-Get "AI_MODE")) {
                $aiExists = $false
                try { az cognitiveservices account show --name $AI_HUB --resource-group $RG 2>$null | Out-Null; $aiExists = ($LASTEXITCODE -eq 0) } catch {}
                if ($aiExists) {
                    _Def-Set "AI_MODE" "create"
                } elseif (_Def-Get "AI_PROJECT_ENDPOINT") {
                    _Def-Set "AI_MODE" "byo"
                }
            }

            if ((_Def-Get "AI_MODE") -eq "create") {
                $AI_PROJECT = "${PREFIX}-ai-project"
                _Def-Default "AI_PROJECT_ENDPOINT" "https://${AI_HUB}.cognitiveservices.azure.com/api/projects/${AI_PROJECT}"

                if (-not (_Def-Get "AI_MODEL_NAME")) {
                    $MODEL_TSV = $null
                    try {
                        $MODEL_TSV = az cognitiveservices account deployment list `
                            --name $AI_HUB --resource-group $RG `
                            --query "[0].[properties.model.name, properties.model.version, sku.capacity]" `
                            -o tsv 2>$null
                    } catch {}
                    if ($MODEL_TSV) {
                        $mCols = $MODEL_TSV -split "`t"
                        if ($mCols[0] -and $mCols[0] -ne "None") { _Def-Set "AI_MODEL_NAME" $mCols[0] }
                        if ($mCols[1] -and $mCols[1] -ne "None") { _Def-Set "AI_MODEL_VERSION" $mCols[1] }
                        if ($mCols[2] -and $mCols[2] -ne "None") { _Def-Set "AI_MODEL_CAPACITY" $mCols[2] }
                    }
                }
            }
        }
    }

    # ── Hardcoded defaults ──
    _Def-Default "DEPLOY_MODE" "k8s"
    _Def-Default "DEPLOY_SCOPE" "all"
    _Def-Default "DATASOURCES" "mock"
    _Def-Default "STREAMING" "enabled"
    _Def-Default "ENABLE_ADMIN_ROUTES" "false"
    _Def-Default "CORS_ORIGINS" "auto"
    _Def-Default "IMAGE_TAG" "latest"
    _Def-Default "AI_MODE" "byo"
    _Def-Default "AI_MODEL_NAME" "gpt-4o-mini"
    _Def-Default "AI_MODEL_VERSION" "2024-07-18"
    _Def-Default "AI_MODEL_CAPACITY" "1"
    _Def-Default "VM_SIZE" "Standard_D2s_v3"
    _Def-Default "NODE_COUNT" "2"
    _Def-Default "AZURE_LOCATION" "eastus"
    _Def-Default "BACKEND_REPLICAS" "1"
    _Def-Default "FRONTEND_REPLICAS" "1"
    _Def-Default "BACKEND_CPU" "250m"
    _Def-Default "BACKEND_CPU_REQUEST" "50m"
    _Def-Default "BACKEND_MEMORY" "512Mi"
    _Def-Default "BACKEND_MEMORY_REQUEST" "256Mi"
    _Def-Default "FRONTEND_CPU" "100m"
    _Def-Default "FRONTEND_CPU_REQUEST" "10m"
    _Def-Default "FRONTEND_MEMORY" "128Mi"
    _Def-Default "FRONTEND_MEMORY_REQUEST" "64Mi"
}
