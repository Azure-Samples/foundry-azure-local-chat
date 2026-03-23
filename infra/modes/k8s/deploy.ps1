# Copyright (c) Microsoft Corporation.
# Licensed under the MIT License.
# ═══════════════════════════════════════════════════════════════
# deploy.ps1 — K8s deploy: build images + apply manifests (PowerShell)
# ═══════════════════════════════════════════════════════════════

$ErrorActionPreference = "Stop"

$ESC = [char]27
$GREEN = "${ESC}[0;32m"; $BLUE = "${ESC}[0;34m"; $NC = "${ESC}[0m"
function log_info    { param([string]$m); Write-Host "${BLUE}`u{2139}`u{FE0F}  ${m}${NC}" }
function log_success { param([string]$m); Write-Host "${GREEN}`u{2705} ${m}${NC}" }

$SCRIPT_DIR = $PSScriptRoot
$REPO_ROOT  = (Resolve-Path (Join-Path $SCRIPT_DIR "..\..\..")).Path
$K8S_DIR    = $SCRIPT_DIR
$INFRA_DIR  = (Resolve-Path (Join-Path $REPO_ROOT "infra")).Path

# Load azd env values into PowerShell variables
$azdValues = azd env get-values 2>$null | Where-Object { $_ -notmatch '^\s*#' -and $_ -match '=' }
foreach ($line in $azdValues) {
    if ($line -match '^([^=]+)=["'']?(.*)["'']?$') {
        $k = $Matches[1]; $v = $Matches[2].Trim('"').Trim("'")
        Set-Item -Path "env:$k" -Value $v
    }
}

# Derive names from prefix
. "$INFRA_DIR\naming.ps1"

# ─── Prerequisites ────────────────────────────────────────────
. "$INFRA_DIR\validate.ps1"
Require-Cli "az"
Require-Cli "kubectl"
Require-Env "ARC_PREFIX" "Resource prefix"
Require-AzLogin
Ensure-ClusterContext
Invoke-ValidateOrExit

# PowerShell replaces envsubst — template YAML files inline
function Invoke-EnvSubst {
    param([string]$TemplatePath)
    $content = Get-Content $TemplatePath -Raw
    # Replace ${VAR_NAME} and $VAR_NAME patterns with env var values
    $content = [regex]::Replace($content, '\$\{([^}]+)\}', {
        param($match)
        $varName = $match.Groups[1].Value
        $val = [Environment]::GetEnvironmentVariable($varName)
        if ($null -ne $val) { $val } else { $match.Value }
    })
    return $content
}

$env:PREFIX      = $script:_PREFIX
$env:ACR_SERVER  = $script:RES_ACR_SERVER
$env:NAMESPACE   = $script:RES_NAMESPACE
$env:WI_CLIENT_ID = $env:AZURE_WI_CLIENT_ID
$env:WI_SA_NAME  = $script:RES_SA
$env:IMAGE_TAG   = if ($env:IMAGE_TAG) { $env:IMAGE_TAG } else { "latest" }
$env:BACKEND_PORT  = "3001"
$env:FRONTEND_PORT = "80"

$ACR_NAME = $script:RES_ACR
$PREFIX   = $script:_PREFIX

Write-Host ""
Write-Host "=================================================="
Write-Host "`u{1F680} Deploy: Build + Push + Apply"
Write-Host "=================================================="
Write-Host ""

$SCOPE = if ($env:DEPLOY_SCOPE) { $env:DEPLOY_SCOPE } else { "all" }
log_info "Scope: $SCOPE"

# ═══════════════════════════════════════════════════════════════
# 0. Cleanup unused deployments (from scope change)
# ═══════════════════════════════════════════════════════════════

if ($env:CLEANUP_FRONTEND -eq "yes") {
    log_info "Removing frontend deployment..."
    kubectl delete "deployment/${PREFIX}-frontend" -n $env:NAMESPACE --ignore-not-found 2>$null
    kubectl delete "service/${PREFIX}-frontend" -n $env:NAMESPACE --ignore-not-found 2>$null
    log_success "Frontend removed"
    azd env set CLEANUP_FRONTEND "" 2>$null
}
if ($env:CLEANUP_BACKEND -eq "yes") {
    log_info "Removing backend deployment..."
    kubectl delete "deployment/${PREFIX}-server" -n $env:NAMESPACE --ignore-not-found 2>$null
    kubectl delete "service/${PREFIX}-server" -n $env:NAMESPACE --ignore-not-found 2>$null
    log_success "Backend removed"
    azd env set CLEANUP_BACKEND "" 2>$null
}

# ═══════════════════════════════════════════════════════════════
# 1. Deploy backend
# ═══════════════════════════════════════════════════════════════

if ($SCOPE -eq "all" -or $SCOPE -eq "backend") {
    log_info "Building backend image..."
    az acr build `
        --registry $ACR_NAME `
        --image "${PREFIX}-server:$($env:IMAGE_TAG)" `
        --file server/Dockerfile `
        "$REPO_ROOT\server"
    log_success "Backend pushed: $($env:ACR_SERVER)/${PREFIX}-server:$($env:IMAGE_TAG)"

    log_info "Applying backend + ingress manifests..."
    foreach ($file in @("namespace.yaml", "backend.yaml", "ingress.yaml")) {
        $yaml = Invoke-EnvSubst (Join-Path $K8S_DIR $file)
        $yaml | kubectl apply -f -
    }
    kubectl rollout restart "deployment/${PREFIX}-server" -n $env:NAMESPACE
    kubectl rollout status "deployment/${PREFIX}-server" -n $env:NAMESPACE --timeout=120s
}

# ═══════════════════════════════════════════════════════════════
# 2. Wait for ingress IP
# ═══════════════════════════════════════════════════════════════

log_info "Waiting for ingress IP..."
$INGRESS_IP = ""
$WAIT_COUNT = 0
while (-not $INGRESS_IP -and $WAIT_COUNT -lt 24) {
    $INGRESS_IP = kubectl get ingress "${PREFIX}-ingress" -n $env:NAMESPACE `
        -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>$null
    if (-not $INGRESS_IP) { Start-Sleep -Seconds 5 }
    $WAIT_COUNT++
}

if (-not $INGRESS_IP) {
    Write-Host "`u{274C} Ingress IP not assigned after 120s. Check: kubectl get ingress -n $($env:NAMESPACE)"
    exit 1
}

# ─── Set CORS for backend ──────
if ($SCOPE -eq "all" -or $SCOPE -eq "backend") {
    if ($INGRESS_IP) {
        if (-not $env:CORS_ORIGINS -or $env:CORS_ORIGINS -eq "auto" -or $env:CORS_ORIGINS -eq "*") {
            $env:CORS_ORIGINS = "https://${INGRESS_IP}"
            log_info "Auto-set CORS_ORIGINS: $($env:CORS_ORIGINS)"
        }
        $yaml = Invoke-EnvSubst (Join-Path $K8S_DIR "backend.yaml")
        $yaml | kubectl apply -f -
        kubectl rollout restart "deployment/${PREFIX}-server" -n $env:NAMESPACE
    }
}

# ═══════════════════════════════════════════════════════════════
# 3. Deploy frontend
# ═══════════════════════════════════════════════════════════════

if ($SCOPE -eq "all" -or $SCOPE -eq "frontend") {
    if (-not $env:VITE_API_URL -and $INGRESS_IP) {
        $env:VITE_API_URL = "https://${INGRESS_IP}/api"
    }
    $apiUrl = if ($env:VITE_API_URL) { $env:VITE_API_URL } else { "/api" }
    log_info "Building frontend image (API URL: $apiUrl)..."
    $buildArgs = @()
    if ($env:VITE_API_URL) { $buildArgs += "--build-arg"; $buildArgs += "VITE_API_URL=$($env:VITE_API_URL)" }
    az acr build `
        --registry $ACR_NAME `
        --image "${PREFIX}-frontend:$($env:IMAGE_TAG)" `
        @buildArgs `
        --file Dockerfile `
        $REPO_ROOT
    log_success "Frontend pushed: $($env:ACR_SERVER)/${PREFIX}-frontend:$($env:IMAGE_TAG)"

    # ─── TLS cert ──────────────────────────────────────────────
    $tlsExists = $false
    try { kubectl get secret "${PREFIX}-tls" -n $env:NAMESPACE 2>$null | Out-Null; $tlsExists = ($LASTEXITCODE -eq 0) } catch {}
    if (-not $tlsExists) {
        log_info "Creating self-signed TLS certificate..."
        $TLS_TMPDIR = Join-Path $env:TEMP "tls-$(Get-Random)"
        New-Item -ItemType Directory -Path $TLS_TMPDIR -Force | Out-Null
        # Generate self-signed cert using .NET crypto (no openssl dependency)
        $rsa = [System.Security.Cryptography.RSA]::Create(2048)
        $req = [System.Security.Cryptography.X509Certificates.CertificateRequest]::new(
            "CN=${PREFIX}", $rsa,
            [System.Security.Cryptography.HashAlgorithmName]::SHA256,
            [System.Security.Cryptography.RSASignaturePadding]::Pkcs1)
        $cert = $req.CreateSelfSigned(
            [DateTimeOffset]::UtcNow,
            [DateTimeOffset]::UtcNow.AddDays(365))
        $certPem = "-----BEGIN CERTIFICATE-----`n" +
            [Convert]::ToBase64String($cert.RawData, 'InsertLineBreaks') +
            "`n-----END CERTIFICATE-----"
        Set-Content -Path "$TLS_TMPDIR\tls.crt" -Value $certPem -NoNewline
        $keyBytes = $rsa.ExportRSAPrivateKey()
        $keyPem = "-----BEGIN RSA PRIVATE KEY-----`n" +
            [Convert]::ToBase64String($keyBytes, 'InsertLineBreaks') +
            "`n-----END RSA PRIVATE KEY-----"
        Set-Content -Path "$TLS_TMPDIR\tls.key" -Value $keyPem -NoNewline
        $rsa.Dispose(); $cert.Dispose()
        kubectl create secret tls "${PREFIX}-tls" `
            --cert="$TLS_TMPDIR\tls.crt" --key="$TLS_TMPDIR\tls.key" `
            -n $env:NAMESPACE
        Remove-Item -Recurse -Force $TLS_TMPDIR -ErrorAction SilentlyContinue
        log_success "TLS cert created"
    }

    # Apply namespace + ingress + frontend
    foreach ($file in @("namespace.yaml", "ingress.yaml", "frontend.yaml")) {
        $yaml = Invoke-EnvSubst (Join-Path $K8S_DIR $file)
        $yaml | kubectl apply -f -
    }
    kubectl rollout restart "deployment/${PREFIX}-frontend" -n $env:NAMESPACE
    kubectl rollout status "deployment/${PREFIX}-frontend" -n $env:NAMESPACE --timeout=120s
}

# ═══════════════════════════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════════════════════════

Write-Host ""
log_success "Deployment complete! (scope: $SCOPE)"
Write-Host ""
if ($SCOPE -eq "all") {
    Write-Host "  `u{1F310} App:      https://${INGRESS_IP}"
    Write-Host "  `u{1F5A5}  Backend:  https://${INGRESS_IP}/health"
    Write-Host "  `u{1F4CB} Frontend: https://${INGRESS_IP}/"
} elseif ($SCOPE -eq "frontend") {
    Write-Host "  `u{1F4CB} Frontend: https://${INGRESS_IP}/"
    Write-Host "  `u{1F517} Backend:  $($env:VITE_API_URL)"
    Write-Host ""
    Write-Host "  `u{26A0}  Add this origin to your backend's CORS config:"
    Write-Host ""
    Write-Host "     Option 1: Allow this frontend only"
    Write-Host "       kubectl set env deployment/${PREFIX}-server -n $($env:NAMESPACE) CORS_ORIGINS=https://${INGRESS_IP}"
    Write-Host ""
    Write-Host "     Option 2: Allow all origins (dev)"
    Write-Host "       kubectl set env deployment/${PREFIX}-server -n $($env:NAMESPACE) CORS_ORIGINS=*"
    Write-Host ""
    Write-Host "     Option 3: Azure Portal"
    Write-Host "       AKS cluster `u{2192} Workloads `u{2192} ${PREFIX}-server `u{2192} Environment variables `u{2192} CORS_ORIGINS"
} elseif ($SCOPE -eq "backend") {
    Write-Host "  `u{1F5A5}  Backend:  https://${INGRESS_IP}/health"
}
Write-Host ""
Write-Host "  Useful commands:"
Write-Host "     kubectl get pods -n $($env:NAMESPACE)"
Write-Host "     kubectl logs -f deployment/${PREFIX}-server -n $($env:NAMESPACE)"
Write-Host ""

# Track deploy state
azd env set DEPLOY_DONE "true" 2>$null
azd env set PREV_DEPLOY_SCOPE $SCOPE 2>$null

# Save config to RG tags
$RESOURCE_GROUP = $script:RES_RESOURCE_GROUP
az group update --name $RESOURCE_GROUP --tags `
    "foundry-chat-deploy-done=true" `
    "foundry-chat-recipe=$($env:RECIPE)" `
    "foundry-chat-scope=${SCOPE}" `
    "foundry-chat-datasources=$($env:DATASOURCES)" `
    "foundry-chat-streaming=$($env:STREAMING)" `
    "foundry-chat-cors=$($env:CORS_ORIGINS)" `
    "foundry-chat-admin=$($env:ENABLE_ADMIN_ROUTES)" `
    "foundry-chat-agent-id=$($env:AI_AGENT_ID)" `
    --output none 2>$null
