# ============================================================
# Modular prerequisites validator (PowerShell)
# ============================================================
# Dot-source this file from any hook/mode script, call the check
# functions you need, then call Invoke-ValidateOrExit.
#
# Usage:
#   . "$PSScriptRoot\..\infra\validate.ps1"
#   Require-Cli "kubectl"
#   Require-Env "AZURE_LOCATION" "Azure region"
#   Ensure-ClusterContext
#   Invoke-ValidateOrExit
# ============================================================

$script:_VALIDATE_ERRORS = ""

function _Install-Hint {
    param([string]$Cmd)
    switch ($Cmd) {
        'az'       { 'winget install Microsoft.AzureCLI' }
        'azd'      { 'winget install Microsoft.Azd' }
        'kubectl'  { 'winget install Kubernetes.kubectl' }
        'openssl'  { 'winget install ShiningLight.OpenSSL' }
        default    { '' }
    }
}

function Require-Cli {
    param([string]$Cmd)
    if (-not (Get-Command $Cmd -ErrorAction SilentlyContinue)) {
        $hint = _Install-Hint $Cmd
        $msg = "  `u{274C} Missing CLI tool: $Cmd"
        if ($hint) { $msg += "`n     Install: $hint" }
        $script:_VALIDATE_ERRORS += "`n$msg"
    }
}

function Require-AzExtension {
    param([string]$ExtName)
    if (-not (Get-Command az -ErrorAction SilentlyContinue)) { return }
    $null = az extension show --name $ExtName 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  `u{2139}`u{FE0F}  Installing az extension: $ExtName..."
        $null = az extension add --name $ExtName --yes 2>$null
        if ($LASTEXITCODE -ne 0) {
            $script:_VALIDATE_ERRORS += "`n  `u{274C} Failed to install az extension: $ExtName"
        }
    }
}

function Require-AzLogin {
    if (-not (Get-Command az -ErrorAction SilentlyContinue)) { return }
    $null = az account show 2>$null
    if ($LASTEXITCODE -ne 0) {
        $script:_VALIDATE_ERRORS += "`n  `u{274C} Not logged into Azure CLI `u{2014} run: az login"
    }
}

function Require-Env {
    param([string]$VarName, [string]$Desc = "")
    $val = [Environment]::GetEnvironmentVariable($VarName)
    if (-not $val) {
        # Also check script-scope and global variables
        $val = Get-Variable -Name $VarName -ValueOnly -Scope Script -ErrorAction SilentlyContinue
        if (-not $val) {
            $val = Get-Variable -Name $VarName -ValueOnly -Scope Global -ErrorAction SilentlyContinue
        }
    }
    if (-not $val) {
        $msg = "  `u{274C} Missing env var: $VarName"
        if ($Desc) { $msg += " `u{2014} $Desc" }
        $script:_VALIDATE_ERRORS += "`n$msg"
    }
}

function Ensure-ClusterContext {
    $expectedCluster = if ($script:RES_CLUSTER) { $script:RES_CLUSTER } else { "" }
    $expectedRg = if ($script:RES_RESOURCE_GROUP) { $script:RES_RESOURCE_GROUP } else { "" }

    if (-not $expectedCluster -or -not $expectedRg) {
        # Try sourcing naming.ps1 to derive names
        $namingScript = Join-Path (Split-Path $PSScriptRoot -Parent) "infra\naming.ps1"
        if (-not (Test-Path $namingScript)) {
            $namingScript = Join-Path $PSScriptRoot "naming.ps1"
        }
        if (Test-Path $namingScript) {
            . $namingScript
            $expectedCluster = $script:RES_CLUSTER
            $expectedRg = $script:RES_RESOURCE_GROUP
        }
    }

    if (-not $expectedCluster) {
        $script:_VALIDATE_ERRORS += "`n  `u{274C} Cannot determine cluster name (ARC_PREFIX not set?)"
        return
    }

    Require-Cli "kubectl"
    if (-not (Get-Command kubectl -ErrorAction SilentlyContinue)) { return }

    $currentContext = kubectl config current-context 2>$null
    if ($LASTEXITCODE -ne 0) { $currentContext = "" }

    if ($currentContext -ne $expectedCluster -and $currentContext -ne "${expectedCluster}-admin") {
        $ctxDisplay = if ($currentContext) { $currentContext } else { "<none>" }
        Write-Host "  `u{2139}`u{FE0F}  kubectl context '$ctxDisplay' doesn't match '$expectedCluster'"
        Write-Host "  `u{2139}`u{FE0F}  Fetching AKS credentials..."
        $null = az aks get-credentials --resource-group $expectedRg --name $expectedCluster --admin --overwrite-existing 2>$null
        if ($LASTEXITCODE -ne 0) {
            $script:_VALIDATE_ERRORS += "`n  `u{274C} Failed to get AKS credentials for $expectedCluster in $expectedRg"
        }
    }
}

function Invoke-ValidateOrExit {
    if ($script:_VALIDATE_ERRORS) {
        Write-Host ""
        Write-Host "  `u{2501}`u{2501}`u{2501} Prerequisites check failed `u{2501}`u{2501}`u{2501}"
        Write-Host $script:_VALIDATE_ERRORS
        Write-Host ""
        Write-Host "  Fix the above issues and re-run."
        exit 1
    }
}
