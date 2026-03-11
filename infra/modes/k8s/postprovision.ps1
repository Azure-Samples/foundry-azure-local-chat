# Copyright (c) Microsoft Corporation.
# Licensed under the MIT License.
# ============================================================
# Post-provision hook — Arc connect + K8s setup (PowerShell)
# ============================================================

$ErrorActionPreference = "Stop"

$ESC = [char]27
$GREEN  = "${ESC}[0;32m"; $BLUE = "${ESC}[0;34m"; $YELLOW = "${ESC}[1;33m"; $RED = "${ESC}[0;31m"; $NC = "${ESC}[0m"
function log_info    { param([string]$m); Write-Host "${BLUE}`u{2139}`u{FE0F}  ${m}${NC}" }
function log_success { param([string]$m); Write-Host "${GREEN}`u{2705} ${m}${NC}" }
function log_warn    { param([string]$m); Write-Host "${YELLOW}`u{26A0}`u{FE0F}  ${m}${NC}" }
function log_error   { param([string]$m); Write-Host "${RED}`u{274C} ${m}${NC}" }

# Derive names from prefix
$MODES_DIR = $PSScriptRoot
$INFRA_DIR = (Resolve-Path (Join-Path $MODES_DIR "..\..")).Path
. "$INFRA_DIR\naming.ps1"

# ─── Prerequisites ───────────────────────────────────────────
. "$INFRA_DIR\validate.ps1"
Require-Cli "az"
Require-Cli "kubectl"
Require-Env "ARC_PREFIX" "Resource prefix"
Require-Env "AZURE_LOCATION" "Azure region"
$DEPLOY_SCOPE = if ($env:DEPLOY_SCOPE) { $env:DEPLOY_SCOPE } else { "all" }
if ($DEPLOY_SCOPE -ne "frontend") {
    Require-Env "AZURE_WI_CLIENT_ID" "Workload Identity client ID"
}
Require-AzLogin
Require-AzExtension "connectedk8s"
Invoke-ValidateOrExit

$PREFIX         = $script:_PREFIX
$RESOURCE_GROUP = $script:RES_RESOURCE_GROUP
$CLUSTER_NAME   = $script:RES_CLUSTER
$NAMESPACE      = $script:RES_NAMESPACE
$LOCATION       = $env:AZURE_LOCATION
$WI_CLIENT_ID   = $env:AZURE_WI_CLIENT_ID
$WI_SA_NAME     = $script:RES_SA

Write-Host ""
Write-Host "=================================================="
Write-Host "`u{1F527} Post-provision: Arc + K8s Setup"
Write-Host "=================================================="
Write-Host ""

# ─── 1. Get AKS credentials ─────────────────────────────────
log_info "Getting AKS credentials..."
az aks get-credentials --resource-group $RESOURCE_GROUP --name $CLUSTER_NAME --admin --overwrite-existing
log_success "kubeconfig configured"

# ─── 2. Connect cluster to Azure Arc ────────────────────────
log_info "Checking Arc connection..."
$arcExists = $false
try { az connectedk8s show --name $CLUSTER_NAME --resource-group $RESOURCE_GROUP 2>$null | Out-Null; $arcExists = ($LASTEXITCODE -eq 0) } catch {}
if ($arcExists) {
    log_success "Already Arc-connected: $CLUSTER_NAME"
} else {
    log_info "Connecting cluster to Azure Arc..."
    az connectedk8s connect --name $CLUSTER_NAME --resource-group $RESOURCE_GROUP --location $LOCATION
    log_success "Arc-connected: $CLUSTER_NAME"
}

# ─── 3. Create namespace + service account ───────────────────
log_info "Setting up namespace and service account..."
$nsExists = $false
try { kubectl get namespace $NAMESPACE 2>$null | Out-Null; $nsExists = ($LASTEXITCODE -eq 0) } catch {}
if (-not $nsExists) { kubectl create namespace $NAMESPACE }

$saYaml = @"
apiVersion: v1
kind: ServiceAccount
metadata:
  name: $WI_SA_NAME
  namespace: $NAMESPACE
  annotations:
    azure.workload.identity/client-id: "$WI_CLIENT_ID"
  labels:
    azure.workload.identity/use: "true"
"@
$saYaml | kubectl apply -f -
log_success "Namespace + Service Account ready"

# ─── 4. Attach ACR to AKS ───────────────────────────────────
$ACR_NAME = $env:AZURE_ACR_NAME
log_info "Attaching ACR to AKS..."
az aks update --name $CLUSTER_NAME --resource-group $RESOURCE_GROUP --attach-acr $ACR_NAME --output none 2>$null
if ($LASTEXITCODE -ne 0) { log_warn "Could not attach ACR `u{2014} may need manual setup or already attached" }
log_success "ACR attached to AKS"

# ─── 5. Link DNS zone to App Routing for auto-TLS ───────────
$DNS_ZONE_ID = $env:AZURE_DNS_ZONE_ID
if ($DNS_ZONE_ID) {
    log_info "Linking DNS zone to App Routing..."
    az aks approuting zone add --resource-group $RESOURCE_GROUP --name $CLUSTER_NAME --ids=$DNS_ZONE_ID --attach-zones --output none 2>$null
    if ($LASTEXITCODE -ne 0) { log_warn "Could not link DNS zone `u{2014} may already be linked" }
    log_success "DNS zone linked to App Routing"
}

Write-Host ""
log_success "Post-provision complete!"
Write-Host ""
