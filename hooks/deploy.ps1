# Copyright (c) Microsoft Corporation.
# Licensed under the MIT License.
# ═══════════════════════════════════════════════════════════════
# deploy.ps1 — Deploy hook entry point (PowerShell)
# ═══════════════════════════════════════════════════════════════
# Shows summary → confirms → deploys. No wizard, no modify.
# To change settings, run 'azd up' and pick Modify.
#
# Can run standalone:  pwsh hooks/deploy.ps1 [-y|--yes]
# Supports scopes:     all | backend | frontend
# ═══════════════════════════════════════════════════════════════

$ErrorActionPreference = "Stop"

$AUTO_YES = if ($env:AUTO_YES -eq "true") { $true } else { $false }
foreach ($arg in $args) {
    if ($arg -eq "-y" -or $arg -eq "--yes") { $AUTO_YES = $true }
}

# Check auto-deploy flag (temp file, survives azd provision)
if (-not $AUTO_YES) {
    $_env_name = ""
    $configPath = Join-Path (Get-Location) ".azure\config.json"
    if (Test-Path $configPath) {
        try {
            $cfg = Get-Content $configPath -Raw | ConvertFrom-Json
            $_env_name = $cfg.defaultEnvironment
        } catch {}
    }
    $flagName = if ($_env_name) { $_env_name } else { "default" }
    $_flag = Join-Path $env:TEMP ".azd-auto-deploy-$flagName"
    if (Test-Path $_flag) {
        $AUTO_YES = $true
        Remove-Item $_flag -Force -ErrorAction SilentlyContinue
    }
}
$env:AUTO_YES = if ($AUTO_YES) { "true" } else { "false" }

$SCRIPT_DIR = $PSScriptRoot
$REPO_ROOT  = (Resolve-Path (Join-Path $SCRIPT_DIR "..")).Path
$INFRA_DIR  = Join-Path $REPO_ROOT "infra"

$ESC = [char]27
$CYAN = "${ESC}[0;36m"; $GREEN = "${ESC}[0;32m"; $YELLOW = "${ESC}[1;33m"; $RED = "${ESC}[0;31m"
$DIM  = "${ESC}[2m"; $BOLD = "${ESC}[1m"; $MAGENTA = "${ESC}[0;35m"; $NC = "${ESC}[0m"

# ═══════════════════════════════════════════════════════════════
# Prerequisites
# ═══════════════════════════════════════════════════════════════

. "$INFRA_DIR\validate.ps1"
Require-Cli "az"
Require-Cli "azd"
Invoke-ValidateOrExit

# ═══════════════════════════════════════════════════════════════
# Load env + defaults
# ═══════════════════════════════════════════════════════════════

Write-Host -NoNewline "  ${DIM}Loading environment...${NC}`r"
. "$INFRA_DIR\prompts.ps1"
. "$INFRA_DIR\defaults.ps1"
Apply-Defaults
Write-Host -NoNewline "                          `r"

# ═══════════════════════════════════════════════════════════════
# Derive prefix + verify infra exists
# ═══════════════════════════════════════════════════════════════

$ARC_PREFIX = Get-Val "ARC_PREFIX"
if (-not $ARC_PREFIX) { $ARC_PREFIX = Get-Val "AZURE_ENV_NAME" }
if (-not $ARC_PREFIX) {
    Write-Host "${RED}`u{274C} No azd environment set. Run 'azd init' first.${NC}"
    exit 1
}

if (-not (Get-Val "AZURE_AKS_CLUSTER_NAME")) {
    Write-Host "${RED}`u{274C} No cluster found for '${ARC_PREFIX}'.${NC}"
    Write-Host "${DIM}Run 'azd up' first to provision infrastructure.${NC}"
    exit 1
}

# ═══════════════════════════════════════════════════════════════
# Summary + confirmation
# ═══════════════════════════════════════════════════════════════

Write-Host -NoNewline "  ${DIM}Preparing summary...${NC}`r"
Save-Val "ARC_NAMESPACE" "${ARC_PREFIX}-ns"

# Reload env values into PowerShell environment
$azdValues = azd env get-values 2>$null | Where-Object { $_ -notmatch '^\s*#' -and $_ -match '=' }
foreach ($line in $azdValues) {
    if ($line -match '^([^=]+)=["'']?(.*)["'']?$') {
        $k = $Matches[1]; $v = $Matches[2].Trim('"').Trim("'")
        Set-Item -Path "env:$k" -Value $v
    }
}
$env:ARC_PREFIX = $ARC_PREFIX
. "$INFRA_DIR\naming.ps1"
Write-Host -NoNewline "                          `r"

Print-ConfigSummary "full" "Deploy"

if (-not $AUTO_YES) {
    Write-Host ""
    Write-Host "  ${DIM}To modify settings, run 'azd up' and pick Modify.${NC}"
    Write-Host ""
    $CONFIRM = Read-Host "  Deploy now? [Y/n]"
    if ($CONFIRM -match "^[Nn]$") {
        Write-Host "  Cancelled."
        exit 0
    }
}

# ─── Delegate to mode-specific deploy script ─────────────────
$azdValues = azd env get-values 2>$null | Where-Object { $_ -notmatch '^\s*#' -and $_ -match '=' }
foreach ($line in $azdValues) {
    if ($line -match '^([^=]+)=["'']?(.*)["'']?$') {
        $k = $Matches[1]; $v = $Matches[2].Trim('"').Trim("'")
        Set-Item -Path "env:$k" -Value $v
    }
}
$env:ARC_PREFIX = $ARC_PREFIX

$DEPLOY_MODE = if ($env:DEPLOY_MODE) { $env:DEPLOY_MODE } else { "k8s" }
$MODE_SCRIPT = Join-Path $REPO_ROOT "infra\modes\$DEPLOY_MODE\deploy.ps1"
if (-not (Test-Path $MODE_SCRIPT)) {
    Write-Host "`u{274C} Unknown DEPLOY_MODE '$DEPLOY_MODE' `u{2014} no script at $MODE_SCRIPT"
    exit 1
}
& $MODE_SCRIPT
