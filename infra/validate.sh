#!/bin/bash
# Copyright (c) Microsoft Corporation.
# Licensed under the MIT License.
# ============================================================
# Modular prerequisites validator
# ============================================================
# Source this file from any hook/mode script, call the check
# functions you need, then call validate_or_exit.
#
# Usage:
#   source "$REPO_ROOT/infra/validate.sh"
#   require_cli  "kubectl"
#   require_cli  "envsubst"
#   require_env  "AZURE_LOCATION" "Azure region"
#   ensure_cluster_context
#   validate_or_exit
# ============================================================
(set -o igncr) 2>/dev/null && set -o igncr; # ignore \r line endings (Windows)

_VALIDATE_ERRORS=""

# Detect platform once
case "$(uname -s)" in
    Darwin*)  _PLATFORM="mac" ;;
    MINGW*|MSYS*|CYGWIN*) _PLATFORM="win" ;;
    *)        _PLATFORM="linux" ;;
esac

# Platform-specific install hints for common tools
_install_hint() {
    local cmd="$1"
    case "$cmd" in
        az)
            case "$_PLATFORM" in
                mac)   echo "brew install azure-cli" ;;
                win)   echo "winget install Microsoft.AzureCLI" ;;
                linux) echo "curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash" ;;
            esac ;;
        azd)
            case "$_PLATFORM" in
                mac)   echo "brew install azd" ;;
                win)   echo "winget install Microsoft.Azd" ;;
                linux) echo "curl -fsSL https://aka.ms/install-azd.sh | bash" ;;
            esac ;;
        kubectl)
            case "$_PLATFORM" in
                mac)   echo "brew install kubectl" ;;
                win)   echo "winget install Kubernetes.kubectl" ;;
                linux) echo "az aks install-cli" ;;
            esac ;;
        envsubst)
            case "$_PLATFORM" in
                mac)   echo "brew install gettext" ;;
                win)   echo "included in Git Bash — run from Git Bash, not cmd/PowerShell" ;;
                linux) echo "sudo apt-get install gettext-base  # or yum install gettext" ;;
            esac ;;
        openssl)
            case "$_PLATFORM" in
                mac)   echo "brew install openssl" ;;
                win)   echo "included in Git Bash" ;;
                linux) echo "sudo apt-get install openssl" ;;
            esac ;;
        *)  echo "" ;;
    esac
}

# ─── require_cli <command> ───────────────────────────────────
# Checks that a CLI tool is available on PATH.
require_cli() {
    local cmd="$1"
    if ! command -v "$cmd" &>/dev/null; then
        local hint
        hint="$(_install_hint "$cmd")"
        local msg="  ❌ Missing CLI tool: ${cmd}"
        [ -n "$hint" ] && msg="${msg}\n     Install: ${hint}"
        _VALIDATE_ERRORS="${_VALIDATE_ERRORS}\n${msg}"
    fi
}

# ─── require_pip ─────────────────────────────────────────────
# Ensures the Python pip module is available (needed by az extension add).
# Some CI environments (e.g. Debian Trixie) omit it — install if missing.
require_pip() {
    if python3 -m pip --version &>/dev/null; then
        return
    fi
    echo "  ℹ️  Installing python3-pip (required by az extension add)..."
    if command -v apt-get &>/dev/null; then
        sudo apt-get install -y -qq python3-pip 2>&1 | tail -3 || true
    else
        _VALIDATE_ERRORS="${_VALIDATE_ERRORS}\n  ❌ python3-pip is missing and apt-get is not available"
    fi
}

# ─── require_az_extension <name> ─────────────────────────────
# Checks that an Azure CLI extension is installed; installs if missing.
# Automatically ensures pip is available first.
# Skipped if az is not available (require_cli "az" already logged that).
require_az_extension() {
    local ext="$1"
    command -v az &>/dev/null || return
    if az extension show --name "$ext" &>/dev/null; then
        return
    fi
    require_pip
    echo "  ℹ️  Installing az extension: ${ext}..."
    echo "  ℹ️  az CLI: $(az version --query '"azure-cli"' -o tsv 2>/dev/null || echo 'unknown')"
    echo "  ℹ️  Python: $(python3 --version 2>/dev/null || echo 'not found')"
    echo "  ℹ️  pip: $(python3 -m pip --version 2>/dev/null || echo 'not found')"
    # Run in a subshell with venv deactivated to prevent .venv's Python 3.13
    # from interfering with az CLI's pip-based extension install
    local ext_output
    if ! ext_output=$(
        unset VIRTUAL_ENV PYTHONHOME
        PATH=$(echo "$PATH" | tr ':' '\n' | grep -v '\.venv' | tr '\n' ':')
        az extension add --name "$ext" --yes 2>&1
    ); then
        _VALIDATE_ERRORS="${_VALIDATE_ERRORS}\n  ❌ Failed to install az extension: ${ext}\n     ${ext_output}"
    fi
}

# ─── require_az_login ────────────────────────────────────────
# Checks that the user is logged into Azure CLI.
require_az_login() {
    command -v az &>/dev/null || return
    if ! az account show &>/dev/null 2>&1; then
        _VALIDATE_ERRORS="${_VALIDATE_ERRORS}\n  ❌ Not logged into Azure CLI — run: az login"
    fi
}

# ─── require_env <VAR> [description] ────────────────────────
# Checks that an environment variable is set and non-empty.
require_env() {
    local var="$1" desc="${2:-}"
    if [ -z "${!var:-}" ]; then
        local msg="  ❌ Missing env var: ${var}"
        [ -n "$desc" ] && msg="${msg} — ${desc}"
        _VALIDATE_ERRORS="${_VALIDATE_ERRORS}\n${msg}"
    fi
}

# ─── ensure_cluster_context ─────────────────────────────────
# Ensures kubectl context points at the expected AKS cluster.
# Requires ARC_PREFIX (or RES_CLUSTER / RES_RESOURCE_GROUP from
# naming.sh) to be set. Gets fresh credentials if the current
# context doesn't match.
ensure_cluster_context() {
    # Resolve expected cluster & RG (source naming.sh if needed)
    local expected_cluster="${RES_CLUSTER:-}"
    local expected_rg="${RES_RESOURCE_GROUP:-}"

    if [ -z "$expected_cluster" ] || [ -z "$expected_rg" ]; then
        # Try sourcing naming.sh to derive names
        local _validate_naming
        _validate_naming="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/naming.sh"
        if [ -f "$_validate_naming" ]; then
            source "$_validate_naming"
            expected_cluster="${RES_CLUSTER:-}"
            expected_rg="${RES_RESOURCE_GROUP:-}"
        fi
    fi

    if [ -z "$expected_cluster" ]; then
        _VALIDATE_ERRORS="${_VALIDATE_ERRORS}\n  ❌ Cannot determine cluster name (ARC_PREFIX not set?)"
        return
    fi

    require_cli "kubectl"
    # If kubectl is missing, skip the context check (require_cli already logged it)
    command -v kubectl &>/dev/null || return

    local current_context
    current_context="$(kubectl config current-context 2>/dev/null || echo "")"

    if [ "$current_context" != "$expected_cluster" ] && \
       [ "$current_context" != "${expected_cluster}-admin" ]; then
        echo "  ℹ️  kubectl context '${current_context:-<none>}' doesn't match '${expected_cluster}'"
        echo "  ℹ️  Fetching AKS credentials..."
        if ! az aks get-credentials \
                --resource-group "$expected_rg" \
                --name "$expected_cluster" \
                --admin --overwrite-existing 2>/dev/null; then
            _VALIDATE_ERRORS="${_VALIDATE_ERRORS}\n  ❌ Failed to get AKS credentials for ${expected_cluster} in ${expected_rg}"
        fi
    fi
}

# ─── validate_or_exit ────────────────────────────────────────
# If any checks failed, prints all errors and exits 1.
validate_or_exit() {
    if [ -n "$_VALIDATE_ERRORS" ]; then
        echo ""
        echo "  ━━━ Prerequisites check failed ━━━"
        echo -e "$_VALIDATE_ERRORS"
        echo ""
        echo "  Fix the above issues and re-run."
        exit 1
    fi
}
