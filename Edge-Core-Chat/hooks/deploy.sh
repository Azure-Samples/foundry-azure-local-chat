#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# deploy.sh — Deploy hook entry point (fast path)
# ═══════════════════════════════════════════════════════════════
# Shows summary → confirms → deploys. No wizard, no modify.
# To change settings, run 'azd up' and pick Modify.
#
# Can run standalone:  bash hooks/deploy.sh [-y|--yes]
# Supports scopes:     all | backend | frontend
# ═══════════════════════════════════════════════════════════════

set -e

AUTO_YES=false
for arg in "$@"; do
    [[ "$arg" == "-y" || "$arg" == "--yes" ]] && AUTO_YES=true
done
# Check if preprovision set auto-deploy flag (temp file, survives azd provision)
if [ "$AUTO_YES" != "true" ]; then
    _env_name=""
    [ -f ".azure/config.json" ] && _env_name=$(grep '"defaultEnvironment"' ".azure/config.json" 2>/dev/null | sed 's/.*: *"\([^"]*\)".*/\1/' || echo "")
    _flag="/tmp/.azd-auto-deploy-${_env_name:-default}"
    if [ -f "$_flag" ]; then
        AUTO_YES=true
        rm -f "$_flag"
    fi
fi
export AUTO_YES

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
INFRA_DIR="$REPO_ROOT/infra"

CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'
DIM='\033[2m'; BOLD='\033[1m'; MAGENTA='\033[0;35m'; NC='\033[0m'

# ═══════════════════════════════════════════════════════════════
# Prerequisites
# ═══════════════════════════════════════════════════════════════

source "$INFRA_DIR/validate.sh"
require_cli "az"
require_cli "azd"
validate_or_exit

# ═══════════════════════════════════════════════════════════════
# Load env + defaults
# ═══════════════════════════════════════════════════════════════

echo -ne "  ${DIM}Loading environment...${NC}\r"
source "$INFRA_DIR/defaults.sh"
apply_defaults
echo -ne "                          \r"

# ═══════════════════════════════════════════════════════════════
# Derive prefix + verify infra exists
# ═══════════════════════════════════════════════════════════════

ARC_PREFIX=$(_def_get "ARC_PREFIX")
[ -z "$ARC_PREFIX" ] && ARC_PREFIX=$(_def_get "AZURE_ENV_NAME")
[ -z "$ARC_PREFIX" ] && { echo -e "${RED}❌ No azd environment set. Run 'azd init' first.${NC}"; exit 1; }

if [ -z "$(_def_get "AZURE_AKS_CLUSTER_NAME")" ]; then
    echo -e "${RED}❌ No cluster found for '${ARC_PREFIX}'.${NC}"
    echo -e "${DIM}Run 'azd up' first to provision infrastructure.${NC}"
    exit 1
fi

# ═══════════════════════════════════════════════════════════════
# Summary + confirmation
# ═══════════════════════════════════════════════════════════════

echo -ne "  ${DIM}Preparing summary...${NC}\r"
_def_set "ARC_NAMESPACE" "${ARC_PREFIX}-ns"
_def_flush
eval "$(azd env get-values | grep -v '^#')"
export ARC_PREFIX
source "$INFRA_DIR/naming.sh"
echo -ne "                          \r"

print_config_summary full "Deploy"

if [ "$AUTO_YES" != "true" ]; then
    echo ""
    echo -e "  ${DIM}To modify settings, run 'azd up' and pick Modify.${NC}"
    echo ""
    read -rsn 100 -t 0.1 2>/dev/null || true
    read -p "  Deploy now? [Y/n]: " CONFIRM
    if [[ "$CONFIRM" =~ ^[Nn]$ ]]; then
        echo "  Cancelled."
        exit 0
    fi
fi

# ─── Delegate to mode-specific deploy script ─────────────────
eval "$(azd env get-values | grep -v '^#')"
export ARC_PREFIX DEPLOY_MODE DEPLOY_SCOPE
DEPLOY_MODE_SCRIPT="$REPO_ROOT/infra/modes/${DEPLOY_MODE:-k8s}/deploy.sh"
if [ ! -f "$DEPLOY_MODE_SCRIPT" ]; then
    echo "❌ Unknown DEPLOY_MODE '${DEPLOY_MODE}' — no script at $DEPLOY_MODE_SCRIPT"
    exit 1
fi
exec "$DEPLOY_MODE_SCRIPT"
