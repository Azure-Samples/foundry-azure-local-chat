# ============================================================
# Shared resource naming helper (PowerShell)
# ============================================================
# Derives all resource names from ARC_PREFIX.
# Dot-source this file: . "$PSScriptRoot\..\infra\naming.ps1"
# ============================================================

function _Clamp {
    param([string]$Name, [int]$Max)
    if ($Name.Length -le $Max) { return $Name }
    $trimmed = $Name.Substring(0, $Max)
    $trimmed = $trimmed.TrimEnd('-')
    return $trimmed
}

$script:_PREFIX = $env:ARC_PREFIX
if (-not $script:_PREFIX) {
    $script:_PREFIX = (Get-Variable -Name 'ARC_PREFIX' -ValueOnly -Scope Script -ErrorAction SilentlyContinue)
}

# Azure resource names
$script:RES_RESOURCE_GROUP = _Clamp "$($script:_PREFIX)-rg" 90
$script:RES_CLUSTER        = _Clamp "$($script:_PREFIX)-cluster" 63
$script:RES_ACR            = (("$($script:_PREFIX)acr") -replace '-','').Substring(0, [Math]::Min(("$($script:_PREFIX)acr" -replace '-','').Length, 50))
$script:RES_ACR_SERVER     = "$($script:RES_ACR).azurecr.io"
$script:RES_NAMESPACE      = _Clamp "$($script:_PREFIX)-ns" 63
$script:RES_IDENTITY       = _Clamp "$($script:_PREFIX)-backend-id" 128
$script:RES_SA             = _Clamp "$($script:_PREFIX)-backend-sa" 253

# Container Apps specific (strict limits)
$script:RES_EXTENSION       = "containerapp-ext"
$script:RES_CUSTOM_LOCATION = _Clamp "$($script:_PREFIX)-location" 63
$script:RES_CONNECTED_ENV   = _Clamp "$($script:_PREFIX)-env" 60
$script:RES_BACKEND_APP     = _Clamp "$($script:_PREFIX)-server" 32
$script:RES_FRONTEND_APP    = _Clamp "$($script:_PREFIX)-frontend" 32

# If names were truncated (don't end with expected suffix), use shorter suffixes
if ($script:RES_BACKEND_APP -notlike '*-server') {
    $script:RES_BACKEND_APP = _Clamp "$($script:_PREFIX)-srv" 32
}
if ($script:RES_FRONTEND_APP -notlike '*-frontend') {
    $script:RES_FRONTEND_APP = _Clamp "$($script:_PREFIX)-fe" 32
}

# Also export as env vars for envsubst-like usage
$env:RES_RESOURCE_GROUP = $script:RES_RESOURCE_GROUP
$env:RES_CLUSTER        = $script:RES_CLUSTER
$env:RES_ACR            = $script:RES_ACR
$env:RES_ACR_SERVER     = $script:RES_ACR_SERVER
$env:RES_NAMESPACE      = $script:RES_NAMESPACE
$env:RES_IDENTITY       = $script:RES_IDENTITY
$env:RES_SA             = $script:RES_SA
$env:RES_EXTENSION       = $script:RES_EXTENSION
$env:RES_CUSTOM_LOCATION = $script:RES_CUSTOM_LOCATION
$env:RES_CONNECTED_ENV   = $script:RES_CONNECTED_ENV
$env:RES_BACKEND_APP     = $script:RES_BACKEND_APP
$env:RES_FRONTEND_APP    = $script:RES_FRONTEND_APP

# Print config summary box
function Print-ConfigSummary {
    param(
        [string]$Level = "full",
        [string]$Title = "Configuration"
    )

    $ESC = [char]27
    $CYAN      = "$ESC[0;36m"
    $GREEN     = "$ESC[0;32m"
    $YELLOW    = "$ESC[1;33m"
    $RED       = "$ESC[0;31m"
    $DIM       = "$ESC[2m"
    $UNDERLINE = "$ESC[4m"
    $NC        = "$ESC[0m"
    $BOLD      = "$ESC[1m"
    $MAGENTA   = "$ESC[0;35m"
    $LABEL     = $DIM
    $VAL       = $CYAN
    $URL       = "${UNDERLINE}${GREEN}"

    $VITE_URL = $env:VITE_API_URL
    $DS       = if ($env:DATASOURCES) { $env:DATASOURCES } else { "mock" }
    $ST       = if ($env:STREAMING) { $env:STREAMING } else { "enabled" }
    $ADMIN    = if ($env:ENABLE_ADMIN_ROUTES) { $env:ENABLE_ADMIN_ROUTES } else { "false" }
    $CORS     = $env:CORS_ORIGINS
    $SCOPE    = if ($env:DEPLOY_SCOPE) { $env:DEPLOY_SCOPE } else { "all" }
    $MODE     = if ($env:DEPLOY_MODE) { $env:DEPLOY_MODE } else { "k8s" }
    $AIMODE   = if ($env:AI_MODE) { $env:AI_MODE } else { "byo" }
    $AI_MODEL = $env:AI_MODEL_NAME
    $AI_VER   = $env:AI_MODEL_VERSION
    $AI_CAP   = $env:AI_MODEL_CAPACITY
    $AI_ENDPOINT = $env:AI_PROJECT_ENDPOINT
    $AI_AGENT = $env:AI_AGENT_ID

    $SUB_NAME = try { (az account show --query name -o tsv 2>$null) } catch { $env:AZURE_SUBSCRIPTION_ID }
    if (-not $SUB_NAME) { $SUB_NAME = $env:AZURE_SUBSCRIPTION_ID }

    $W = 48

    function _Row {
        param([string]$Plain, [string]$Formatted)
        $pad = $W - $Plain.Length
        if ($pad -lt 0) { $pad = 0 }
        Write-Host ("  | {0}{1}|" -f $Formatted, (' ' * $pad)) -NoNewline
        Write-Host ""
    }

    Write-Host ""
    Write-Host "  ${DIM}Workflow:${NC} ${BOLD}${MAGENTA}${Title}${NC}"
    $border = [string]::new([char]0x2500, ($W + 1))
    Write-Host "  `u{250C}${border}`u{2510}"
    _Row "Target" "${YELLOW}Target${NC}"
    _Row "  Prefix:       $($script:_PREFIX)" "  Prefix:       ${VAL}$($script:_PREFIX)${NC}"
    _Row "  Subscription: $SUB_NAME" "  Subscription: ${VAL}${SUB_NAME}${NC}"
    _Row "" ""

    if ($Level -eq "full") {
        $CLUSTER = if ($env:AZURE_AKS_CLUSTER_NAME) { $env:AZURE_AKS_CLUSTER_NAME } else { $script:RES_CLUSTER }
        $RG = if ($env:AZURE_RESOURCE_GROUP) { $env:AZURE_RESOURCE_GROUP } else { $script:RES_RESOURCE_GROUP }
        $NS = if ($env:AZURE_NAMESPACE) { $env:AZURE_NAMESPACE } else { $script:RES_NAMESPACE }
        $NC_VAL = if ($env:NODE_COUNT) { $env:NODE_COUNT } else { "2" }
        $VM_VAL = if ($env:VM_SIZE) { $env:VM_SIZE } else { "Standard_D4s_v3" }

        _Row "Infra" "${YELLOW}Infra${NC}"
        _Row "  Cluster:      $CLUSTER" "  Cluster:      ${VAL}${CLUSTER}${NC}"
        _Row "  RG:           $RG" "  RG:           ${VAL}${RG}${NC}"
        _Row "  Namespace:    $NS" "  Namespace:    ${VAL}${NS}${NC}"
        _Row "  Mode:         $MODE" "  Mode:         ${VAL}${MODE}${NC}"
        _Row "  Nodes:        $NC_VAL x $VM_VAL" "  Nodes:        ${VAL}${NC_VAL} x ${VM_VAL}${NC}"
        _Row "" ""
    }

    _Row "Deploy" "${YELLOW}Deploy${NC}"
    _Row "  Scope:        $SCOPE" "  Scope:        ${VAL}${SCOPE}${NC}"

    if ($SCOPE -eq "frontend") {
        if ($VITE_URL) {
            _Row "  API URL:      $VITE_URL" "  API URL:      ${URL}${VITE_URL}${NC}"
        } else {
            _Row "  API URL:      (not set)" "  API URL:      ${RED}(not set)${NC}"
        }
    }

    if ($SCOPE -ne "frontend") {
        _Row "  Datasource:   $DS" "  Datasource:   ${VAL}${DS}${NC}"
        _Row "  Streaming:    $ST" "  Streaming:    ${VAL}${ST}${NC}"
        _Row "  Admin:        $ADMIN" "  Admin:        ${VAL}${ADMIN}${NC}"
        _Row "  AI Mode:      $AIMODE" "  AI Mode:      ${VAL}${AIMODE}${NC}"

        if ($AIMODE -eq "create") {
            _Row "  Model:        $AI_MODEL ($AI_VER)" "  Model:        ${VAL}${AI_MODEL}${NC} ${DIM}(${AI_VER})${NC}"
            _Row "  Capacity:     ${AI_CAP}K TPM" "  Capacity:     ${VAL}${AI_CAP}K TPM${NC}"
            if ($AI_AGENT) {
                _Row "  Agent:        $AI_AGENT" "  Agent:        ${VAL}${AI_AGENT}${NC}"
            } else {
                _Row "  Agent:        (auto-created)" "  Agent:        ${DIM}(auto-created)${NC}"
            }
        } elseif ($AIMODE -eq "byo") {
            $SHORT_EP = $AI_ENDPOINT
            if ($SHORT_EP -and $SHORT_EP.Length -gt 30) { $SHORT_EP = $SHORT_EP.Substring(0, 30) + "..." }
            _Row "  Endpoint:     $SHORT_EP" "  Endpoint:     ${URL}${SHORT_EP}${NC}"
            _Row "  Agent:        $AI_AGENT" "  Agent:        ${VAL}${AI_AGENT}${NC}"
        }

        if ($CORS -and $CORS -ne "*" -and $CORS -ne "auto") {
            _Row "  CORS:         $CORS" "  CORS:         ${URL}${CORS}${NC}"
        } elseif ($CORS -eq "*") {
            _Row "  CORS:         * (all origins)" "  CORS:         ${VAL}*${NC} ${DIM}(all origins)${NC}"
        } else {
            _Row "  CORS:         (auto-detect)" "  CORS:         ${DIM}(auto-detect)${NC}"
        }
    }

    Write-Host "  `u{2514}${border}`u{2518}"
    Write-Host ""
}
