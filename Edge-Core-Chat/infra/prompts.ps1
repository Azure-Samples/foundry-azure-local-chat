# ═══════════════════════════════════════════════════════════════
# prompts.ps1 — Shared interactive prompt library (PowerShell)
# ═══════════════════════════════════════════════════════════════
# Dot-source this file from any hook script to get TUI helpers:
#   Get-Val, Save-Val, Save-Cached, Flush-Env, Set-Default, Show-Section,
#   Prompt-Val, Prompt-Choice, Prompt-Select, Prompt-Search,
#   Invoke-AzFetchList, Check-ModelQuota
# ═══════════════════════════════════════════════════════════════

$ESC = [char]27
$script:CYAN    = "${ESC}[0;36m"
$script:GREEN   = "${ESC}[0;32m"
$script:YELLOW  = "${ESC}[1;33m"
$script:RED     = "${ESC}[0;31m"
$script:DIM     = "${ESC}[2m"
$script:BOLD    = "${ESC}[1m"
$script:MAGENTA = "${ESC}[0;35m"
$script:NC      = "${ESC}[0m"

# ═══════════════════════════════════════════════════════════════
# Environment cache — reads/writes .azure/<env>/.env directly
# ═══════════════════════════════════════════════════════════════

$script:_ENV_FILE = ""

function _Init-EnvFile {
    if ($script:_ENV_FILE) { return }
    $searchDirs = @(".", $env:REPO_ROOT)
    if ($env:INFRA_DIR) { $searchDirs += (Split-Path $env:INFRA_DIR -Parent) }
    # $PSScriptRoot/.. resolves repo root when this file lives in infra/
    if ($PSScriptRoot) { $searchDirs += (Split-Path $PSScriptRoot -Parent) }

    foreach ($dir in $searchDirs) {
        if (-not $dir) { continue }
        $configPath = Join-Path $dir ".azure\config.json"
        if (Test-Path $configPath) {
            $configJson = Get-Content $configPath -Raw -ErrorAction SilentlyContinue
            if ($configJson -match '"defaultEnvironment"\s*:\s*"([^"]*)"') {
                $envName = $Matches[1]
                $envFile = Join-Path $dir ".azure\$envName\.env"
                if ($envName -and (Test-Path $envFile)) {
                    $script:_ENV_FILE = (Resolve-Path $envFile).Path
                }
            }
            break
        }
    }
}

_Init-EnvFile

function Get-Val {
    param([string]$VarName)
    if (-not $script:_ENV_FILE) {
        try { $val = azd env get-value $VarName 2>$null; return $val } catch { return "" }
    }
    $lines = Get-Content $script:_ENV_FILE -ErrorAction SilentlyContinue
    foreach ($line in $lines) {
        if ($line -match "^${VarName}=(.*)$") {
            $val = $Matches[1]
            $val = $val.Trim('"')
            return $val
        }
    }
    return ""
}

function Save-Val {
    param([string]$VarName, [string]$Value)
    if (-not $script:_ENV_FILE) {
        try { azd env set $VarName $Value 2>$null } catch {}
        return
    }
    $lines = Get-Content $script:_ENV_FILE -ErrorAction SilentlyContinue
    $found = $false
    $newLines = @()
    if ($lines) {
        foreach ($line in $lines) {
            if ($line -match "^${VarName}=") {
                $newLines += "${VarName}=`"${Value}`""
                $found = $true
            } else {
                $newLines += $line
            }
        }
    }
    if (-not $found) {
        $newLines += "${VarName}=`"${Value}`""
    }
    $newLines | Set-Content $script:_ENV_FILE -Encoding utf8
}

function Save-Cached { param([string]$VarName, [string]$Value); Save-Val $VarName $Value }
function Flush-Env { }
function Set-Default {
    param([string]$VarName, [string]$Value)
    $cur = Get-Val $VarName
    if (-not $cur) { Save-Val $VarName $Value }
}

# ═══════════════════════════════════════════════════════════════
# Section helper
# ═══════════════════════════════════════════════════════════════

function Show-Section {
    param([string]$Header, [string]$SubText = "")
    Write-Host ""
    Write-Host "  $($script:BOLD)$($script:YELLOW)${Header}$($script:NC)"
    if ($SubText) { Write-Host "  $($script:DIM)${SubText}$($script:NC)" }
    Write-Host ""
}

# ═══════════════════════════════════════════════════════════════
# Prompt-Val — free-text input
# ═══════════════════════════════════════════════════════════════

function Prompt-Val {
    param(
        [string]$VarName,
        [string]$Label,
        [string]$Default = "",
        [string]$Required = "",
        [string]$Help = ""
    )
    $current = Get-Val $VarName
    if ($script:AUTO_YES -eq "true" -or $env:AUTO_YES -eq "true") {
        if ($current) { return }
        if ($Default) { Save-Val $VarName $Default; return }
        if ($Required -eq "--required") {
            Write-Host "  $($script:RED)`u{274C} $VarName required. azd env set $VarName `"<value>`"$($script:NC)"
            exit 1
        }
        return
    }
    if ($Help) { Write-Host "  $($script:DIM)${Help}$($script:NC)" }
    $show = if ($current) { $current } elseif ($Default) { $Default } else { "" }
    $suffix = if ($show) { " $($script:DIM)[${show}]$($script:NC)" } else { "" }
    Write-Host -NoNewline "  ${Label}${suffix}: $($script:CYAN)"
    $input = Read-Host
    Write-Host -NoNewline $script:NC
    $input = $input -replace '[^\x20-\x7E]', ''
    $value = if ($input) { $input } elseif ($current) { $current } elseif ($Default) { $Default } else { "" }
    if (-not $value -and $Required -eq "--required") {
        Write-Host "  $($script:RED)Required. Please enter a value.$($script:NC)"
        Prompt-Val $VarName $Label $Default $Required $Help
        return
    }
    if ($value) { Save-Val $VarName $value }
}

# ═══════════════════════════════════════════════════════════════
# Prompt-Choice — arrow-key selector for static options
# ═══════════════════════════════════════════════════════════════

function Prompt-Choice {
    param(
        [string]$VarName,
        [string]$Label,
        [string[]]$Options
    )
    $values = @()
    $descs = @()
    foreach ($opt in $Options) {
        $parts = $opt -split '\|', 2
        $values += $parts[0]
        $descs += $parts[1]
    }
    $current = Get-Val $VarName
    if (($script:AUTO_YES -eq "true" -or $env:AUTO_YES -eq "true")) {
        if ($current) { return }
        Save-Val $VarName $values[0]
        return
    }

    $sel = 0
    if ($current) {
        for ($i = 0; $i -lt $values.Count; $i++) {
            if ($values[$i] -eq $current) { $sel = $i }
        }
    }
    $count = $values.Count

    Write-Host "  ${Label} $($script:DIM)(`u{2191}/`u{2193} to move, Enter to select)$($script:NC)"

    function _DrawChoices {
        for ($i = 0; $i -lt $count; $i++) {
            $marker = ""
            if ($current -and $values[$i] -eq $current) { $marker = " $($script:CYAN)`u{2190} current$($script:NC)" }
            if ($i -eq $sel) {
                Write-Host "  $($script:GREEN)`u{276F} $($values[$i])$($script:NC) `u{2014} $($descs[$i])${marker}"
            } else {
                Write-Host "    $($values[$i]) $($script:DIM)`u{2014} $($descs[$i])$($script:NC)${marker}"
            }
        }
    }

    _DrawChoices

    while ($true) {
        $key = [Console]::ReadKey($true)
        if ($key.Key -eq 'UpArrow') {
            $sel = ($sel - 1 + $count) % $count
            Write-Host -NoNewline "${ESC}[${count}A"
            _DrawChoices
        } elseif ($key.Key -eq 'DownArrow') {
            $sel = ($sel + 1) % $count
            Write-Host -NoNewline "${ESC}[${count}A"
            _DrawChoices
        } elseif ($key.Key -eq 'Enter') {
            break
        } elseif ($key.KeyChar -ge '1' -and $key.KeyChar -le '9') {
            $num = [int]::Parse($key.KeyChar.ToString()) - 1
            if ($num -ge 0 -and $num -lt $count) {
                $sel = $num
                Write-Host -NoNewline "${ESC}[${count}A"
                _DrawChoices
                break
            }
        }
    }

    Save-Val $VarName $values[$sel]
    Write-Host ""
}

# ═══════════════════════════════════════════════════════════════
# Prompt-Select — arrow-key selector for dynamic lists
# ═══════════════════════════════════════════════════════════════

function Prompt-Select {
    param(
        [string]$VarName,
        [string]$Label,
        [string[]]$Values,
        [string[]]$Display,
        [string]$Help = "",
        [string]$Default = ""
    )
    $current = Get-Val $VarName
    if (($script:AUTO_YES -eq "true" -or $env:AUTO_YES -eq "true")) {
        if ($current) { return }
        if ($Default) { Save-Val $VarName $Default; return }
        if ($Values.Count -gt 0) { Save-Val $VarName $Values[0] }
        return
    }
    if ($Help) { Write-Host "  $($script:DIM)${Help}$($script:NC)" }

    $count = $Values.Count
    $sel = 0
    if ($current) {
        for ($i = 0; $i -lt $count; $i++) {
            if ($Values[$i] -eq $current) { $sel = $i }
        }
    } elseif ($Default) {
        for ($i = 0; $i -lt $count; $i++) {
            if ($Values[$i] -eq $Default) { $sel = $i }
        }
    }

    Write-Host "  ${Label} $($script:DIM)(`u{2191}/`u{2193} move, Enter select, Esc back)$($script:NC)"

    function _DrawSelect {
        for ($i = 0; $i -lt $count; $i++) {
            $marker = ""
            if ($current -and $Values[$i] -eq $current) { $marker = " $($script:CYAN)`u{2190} current$($script:NC)" }
            if ($i -eq $sel) {
                Write-Host "  $($script:GREEN)`u{276F} $($Display[$i])$($script:NC)${marker}"
            } else {
                Write-Host "    $($Display[$i])${marker}"
            }
        }
    }

    _DrawSelect

    $numBuf = ""
    while ($true) {
        $key = [Console]::ReadKey($true)
        if ($key.Key -eq 'Escape') {
            Write-Host -NoNewline "${ESC}[${count}A"
            for ($i = 0; $i -lt $count; $i++) { Write-Host "${ESC}[2K" }
            Write-Host -NoNewline "${ESC}[${count}A"
            Save-Val $VarName "__back__"
            return
        } elseif ($key.Key -eq 'UpArrow') {
            $sel = ($sel - 1 + $count) % $count
            Write-Host -NoNewline "${ESC}[${count}A"
            _DrawSelect
        } elseif ($key.Key -eq 'DownArrow') {
            $sel = ($sel + 1) % $count
            Write-Host -NoNewline "${ESC}[${count}A"
            _DrawSelect
        } elseif ($key.Key -eq 'Enter') {
            break
        } elseif ($key.KeyChar -ge '0' -and $key.KeyChar -le '9') {
            $numBuf += $key.KeyChar.ToString()
            $idx = [int]$numBuf - 1
            if ($idx -ge 0 -and $idx -lt $count) {
                $sel = $idx
                Write-Host -NoNewline "${ESC}[${count}A"
                _DrawSelect
            }
            if ($numBuf.Length -ge 2 -or ([int]$numBuf * 10) -gt $count) {
                $numBuf = ""
            }
        } else {
            $numBuf = ""
        }
    }

    Save-Val $VarName $Values[$sel]
    Write-Host ""
}

# ═══════════════════════════════════════════════════════════════
# Prompt-Search — type-to-filter for long lists
# ═══════════════════════════════════════════════════════════════

function Prompt-Search {
    param(
        [string]$VarName,
        [string]$Label,
        [string[]]$Values,
        [string[]]$Display,
        [string]$Help = "",
        [string]$FilterHint = "type to filter"
    )
    $current = Get-Val $VarName
    if (($script:AUTO_YES -eq "true" -or $env:AUTO_YES -eq "true")) {
        if ($current) { return }
        if ($Values.Count -gt 0) { Save-Val $VarName $Values[0] }
        return
    }
    if ($Help) { Write-Host "  $($script:DIM)${Help}$($script:NC)" }

    while ($true) {
        Write-Host -NoNewline "  ${Label} $($script:DIM)(${FilterHint})$($script:NC): $($script:CYAN)"
        $filter = Read-Host
        Write-Host -NoNewline $script:NC

        if (-not $filter -and $current) {
            Write-Host "  Keeping: $($script:CYAN)${current}$($script:NC)"
            Write-Host ""
            return
        }

        $matchV = @()
        $matchD = @()
        for ($i = 0; $i -lt $Values.Count; $i++) {
            if (-not $filter -or "$($Values[$i]) $($Display[$i])" -match [regex]::Escape($filter)) {
                $matchV += $Values[$i]
                $matchD += $Display[$i]
            }
        }

        if ($matchV.Count -eq 0) {
            Write-Host "  $($script:YELLOW)No matches for '${filter}'. Try again.$($script:NC)"
            continue
        } elseif ($matchV.Count -eq 1) {
            Save-Val $VarName $matchV[0]
            Write-Host "  Selected: $($script:CYAN)$($matchV[0])$($script:NC)"
            Write-Host ""
            return
        }

        for ($i = 0; $i -lt $matchV.Count; $i++) {
            Write-Host "    $($script:BOLD)$($i+1))$($script:NC) $($matchD[$i])"
        }
        Write-Host -NoNewline "  Choice $($script:DIM)[1]$($script:NC): $($script:CYAN)"
        $choice = Read-Host
        Write-Host -NoNewline $script:NC
        if (-not $choice) { $choice = "1" }
        $choiceNum = 0
        if ([int]::TryParse($choice, [ref]$choiceNum) -and $choiceNum -ge 1 -and $choiceNum -le $matchV.Count) {
            Save-Val $VarName $matchV[$choiceNum - 1]
            Write-Host ""
            return
        } else {
            Write-Host "  $($script:YELLOW)Invalid choice. Try again.$($script:NC)"
        }
    }
}

# ═══════════════════════════════════════════════════════════════
# Invoke-AzFetchList — fetch Azure data with timeout
# ═══════════════════════════════════════════════════════════════

function Invoke-AzFetchList {
    param(
        [string]$AzCommand,
        [string]$JmesQuery = "",
        [string]$LoadingMsg = "Loading...",
        [int]$TimeoutSec = 15
    )
    Write-Host -NoNewline "  $($script:DIM)${LoadingMsg}$($script:NC)`r"
    $results = @()
    try {
        $fullCmd = $AzCommand
        if ($JmesQuery) { $fullCmd += " --query `"$JmesQuery`"" }
        $fullCmd += " -o tsv"

        $job = Start-Job -ScriptBlock { param($cmd) Invoke-Expression $cmd 2>$null } -ArgumentList $fullCmd
        $completed = Wait-Job $job -Timeout $TimeoutSec
        if ($completed) {
            $output = Receive-Job $job
            $results = $output
        } else {
            Stop-Job $job -ErrorAction SilentlyContinue
            Write-Host -NoNewline "  $($script:YELLOW)Timed out after ${TimeoutSec}s$($script:NC)                `r"
        }
        Remove-Job $job -Force -ErrorAction SilentlyContinue
    } catch {}
    Write-Host -NoNewline "                                           `r"
    return $results
}

# ═══════════════════════════════════════════════════════════════
# Check-ModelQuota — validate TPM quota for a model deployment
# ═══════════════════════════════════════════════════════════════

function Check-ModelQuota {
    param(
        [string]$Location,
        [string]$Model,
        [string]$Sku = "GlobalStandard",
        [int]$Capacity,
        [string]$CapacityVar = "AI_MODEL_CAPACITY"
    )

    $modelType = "OpenAI.${Sku}.${Model}"
    Write-Host -NoNewline "  $($script:DIM)Checking quota for ${Model} in ${Location}...$($script:NC)"

    $usageJson = $null
    try {
        $usageJson = az cognitiveservices usage list --location $Location `
            --query "[?name.value=='$modelType']" -o json 2>$null | ConvertFrom-Json
    } catch {}

    if (-not $usageJson -or $usageJson.Count -eq 0) {
        Write-Host " $($script:YELLOW)no quota info found (will try anyway)$($script:NC)"
        return $true
    }

    $currentVal = [int]($usageJson[0].currentValue)
    $limitVal = [int]($usageJson[0].limit)
    $available = $limitVal - $currentVal

    Write-Host " $($script:GREEN)available: ${available}K TPM$($script:NC) $($script:DIM)(used: ${currentVal}, limit: ${limitVal})$($script:NC)"

    if ($available -lt $Capacity) {
        if ($available -ge 1) {
            Write-Host "  $($script:YELLOW)`u{26A0} Requested ${Capacity}K TPM but only ${available}K available.$($script:NC)"
            if (($script:AUTO_YES -eq "true" -or $env:AUTO_YES -eq "true")) {
                Save-Val $CapacityVar "$available"
                Write-Host "  $($script:DIM)Auto-reduced capacity to ${available}K TPM.$($script:NC)"
            } else {
                Prompt-Val $CapacityVar "Adjusted capacity (1-${available})" "$available" "--required" `
                    "Enter a capacity between 1 and ${available} (in thousands TPM)"
            }
        } else {
            Write-Host "  $($script:RED)`u{274C} No quota available for ${Model} in ${Location}.$($script:NC)"
            Write-Host "  $($script:DIM)Try a different region or model.$($script:NC)"
            return $false
        }
    } else {
        Write-Host "  $($script:GREEN)`u{2705} Sufficient quota$($script:NC) $($script:DIM)(requested: ${Capacity}K, available: ${available}K)$($script:NC)"
    }
    return $true
}
