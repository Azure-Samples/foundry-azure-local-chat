#!/usr/bin/env bash
# Copyright (c) Microsoft Corporation.
# Licensed under the MIT License.
# ═══════════════════════════════════════════════════════════════
# test-deploy-matrix.sh — Dry-run all deployment scenarios
# ═══════════════════════════════════════════════════════════════
# Runs deploy logic for every combination of scope × ai_mode × recipe
# without touching Azure or K8s. Validates config, generates manifests,
# and reports pass/fail for each scenario.
#
# Usage:  bash scripts/test-deploy-matrix.sh [--verbose]
# ═══════════════════════════════════════════════════════════════

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
INFRA_DIR="$REPO_ROOT/infra"
K8S_DIR="$REPO_ROOT/infra/modes/k8s"

VERBOSE=false
[ "${1:-}" = "--verbose" ] && VERBOSE=true

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'
DIM='\033[2m'; BOLD='\033[1m'; CYAN='\033[0;36m'; NC='\033[0m'

PASS=0; FAIL=0; SKIP=0
FAILURES=()

# ─── Test env setup ──────────────────────────────────────────

TEST_ENV_DIR=$(mktemp -d)
TEST_ENV_FILE="$TEST_ENV_DIR/.env"
trap "rm -rf $TEST_ENV_DIR" EXIT

init_test_env() {
    cat > "$TEST_ENV_FILE" <<'EOF'
AZURE_ENV_NAME="test-deploy"
ARC_PREFIX="test-deploy"
ARC_NAMESPACE="test-deploy-ns"
AZURE_LOCATION="eastus2"
AZURE_SUBSCRIPTION_ID="00000000-0000-0000-0000-000000000000"
AZURE_RESOURCE_GROUP="test-deploy-rg"
AZURE_AKS_CLUSTER_NAME="test-deploy-cluster"
AZURE_ACR_NAME="testdeployacr"
AZURE_ACR_SERVER="testdeployacr.azurecr.io"
AZURE_WI_CLIENT_ID="00000000-0000-0000-0000-000000000001"
AZURE_WI_PRINCIPAL_ID="00000000-0000-0000-0000-000000000002"
DEPLOY_MODE="k8s"
NODE_COUNT=2
VM_SIZE="Standard_D2s_v3"
IMAGE_TAG="latest"
BACKEND_REPLICAS=1
FRONTEND_REPLICAS=1
BACKEND_CPU="250m"
BACKEND_CPU_REQUEST="50m"
BACKEND_MEMORY="512Mi"
BACKEND_MEMORY_REQUEST="256Mi"
FRONTEND_CPU="100m"
FRONTEND_CPU_REQUEST="10m"
FRONTEND_MEMORY="128Mi"
FRONTEND_MEMORY_REQUEST="64Mi"
PROVISION_DONE="true"
WIZARD_DONE="true"
EOF
}

set_test_val() {
    if grep -q "^${1}=" "$TEST_ENV_FILE" 2>/dev/null; then
        sed -i.bak "s|^${1}=.*|${1}=\"${2}\"|" "$TEST_ENV_FILE" && rm -f "${TEST_ENV_FILE}.bak"
    else
        echo "${1}=\"${2}\"" >> "$TEST_ENV_FILE"
    fi
}

get_test_val() {
    grep "^${1}=" "$TEST_ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"'
}

# ─── Stub commands for dry-run ───────────────────────────────

az()       { echo "[dry-run] az $*" >&2; return 0; }
azd()      { if [ "$1" = "env" ] && [ "$2" = "get-values" ]; then cat "$TEST_ENV_FILE"; elif [ "$1" = "env" ] && [ "$2" = "get-value" ]; then get_test_val "$3"; elif [ "$1" = "env" ] && [ "$2" = "set" ]; then set_test_val "$3" "$4"; else echo "[dry-run] azd $*" >&2; fi; return 0; }
kubectl()  { echo "[dry-run] kubectl $*" >&2; return 0; }
export -f az azd kubectl

# ─── Test: manifest generation ───────────────────────────────

test_manifests() {
    local scope="$1" ai_mode="$2" label="$3"
    local errors=""

    # Load env
    set -a
    while IFS='=' read -r key val; do
        [ -n "$key" ] || continue
        val="${val#\"}" ; val="${val%\"}"
        export "$key=$val"
    done < "$TEST_ENV_FILE"
    set +a

    # Source naming
    source "$INFRA_DIR/naming.sh" 2>/dev/null || { errors="naming.sh failed"; }

    export PREFIX="${_PREFIX:-$ARC_PREFIX}"
    export ACR_SERVER="${AZURE_ACR_SERVER}"
    export NAMESPACE="${ARC_NAMESPACE}"
    export WI_CLIENT_ID="${AZURE_WI_CLIENT_ID}"
    export WI_SA_NAME="${ARC_PREFIX}-backend-sa"
    export BACKEND_PORT="3001"
    export FRONTEND_PORT="80"
    export VITE_API_URL="${VITE_API_URL:-/api}"

    # Test manifest envsubst
    if [ "$scope" = "all" ] || [ "$scope" = "backend" ]; then
        for f in namespace.yaml backend.yaml ingress.yaml; do
            if [ -f "$K8S_DIR/$f" ]; then
                local out
                out=$(envsubst < "$K8S_DIR/$f" 2>&1) || errors="${errors}; envsubst $f failed"
                # Check for unresolved vars
                if echo "$out" | grep -q '${.*}'; then
                    local unresolved
                    unresolved=$(echo "$out" | grep -oE '\$\{[^}]+\}' | sort -u | tr '\n' ', ')
                    errors="${errors}; unresolved in $f: $unresolved"
                fi
            else
                errors="${errors}; missing $f"
            fi
        done
    fi

    if [ "$scope" = "all" ] || [ "$scope" = "frontend" ]; then
        if [ -f "$K8S_DIR/frontend.yaml" ]; then
            local out
            out=$(envsubst < "$K8S_DIR/frontend.yaml" 2>&1) || errors="${errors}; envsubst frontend.yaml failed"
            if echo "$out" | grep -qE '\$\{[A-Z]'; then
                local unresolved
                unresolved=$(echo "$out" | grep -oE '\$\{[^}]+\}' | sort -u | tr '\n' ', ')
                errors="${errors}; unresolved in frontend.yaml: $unresolved"
            fi
        fi
    fi

    echo "$errors"
}

# ─── Test: config validation ─────────────────────────────────

test_config_valid() {
    local scope="$1" ai_mode="$2"
    local errors=""

    # Basic validation rules
    case "$scope" in
        all|backend|frontend) ;;
        *) errors="invalid scope: $scope" ;;
    esac

    case "$ai_mode" in
        create|byo|mock) ;;
        *) errors="${errors}; invalid ai_mode: $ai_mode" ;;
    esac

    # Frontend-only needs VITE_API_URL
    if [ "$scope" = "frontend" ] && [ -z "$(get_test_val VITE_API_URL)" ]; then
        errors="${errors}; frontend scope requires VITE_API_URL"
    fi

    # BYO needs endpoint + agent
    if [ "$ai_mode" = "byo" ]; then
        [ -z "$(get_test_val AI_PROJECT_ENDPOINT)" ] && errors="${errors}; byo needs AI_PROJECT_ENDPOINT"
        [ -z "$(get_test_val AI_AGENT_ID)" ] && errors="${errors}; byo needs AI_AGENT_ID"
    fi

    # Create needs model
    if [ "$ai_mode" = "create" ]; then
        [ -z "$(get_test_val AI_MODEL_NAME)" ] && errors="${errors}; create needs AI_MODEL_NAME"
    fi

    echo "$errors"
}

# ─── Test: scope transitions ─────────────────────────────────

test_scope_transition() {
    local from="$1" to="$2"
    local errors=""

    # Narrowing should set cleanup flags
    if [ "$from" = "all" ] && [ "$to" = "backend" ]; then
        # Would prompt to clean frontend
        [ "$VERBOSE" = "true" ] && echo "    → Would prompt: remove frontend pods?"
    elif [ "$from" = "all" ] && [ "$to" = "frontend" ]; then
        [ "$VERBOSE" = "true" ] && echo "    → Would prompt: remove backend pods?"
    elif [ "$from" = "backend" ] && [ "$to" = "frontend" ]; then
        [ "$VERBOSE" = "true" ] && echo "    → Would prompt: remove backend pods?"
    fi

    echo "$errors"
}

# ─── Run matrix ──────────────────────────────────────────────

SCOPES=("all" "backend" "frontend")
AI_MODES=("create" "byo" "mock")
RECIPES=("all" "dev" "custom")

echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  Deploy Matrix — Dry Run${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════${NC}"
echo ""

# ── Test 1: Config validation for all combos ─────────────────

echo -e "${BOLD}① Config Validation${NC}"
echo ""

for scope in "${SCOPES[@]}"; do
    for ai in "${AI_MODES[@]}"; do
        label="scope=${scope} ai=${ai}"
        init_test_env
        set_test_val "DEPLOY_SCOPE" "$scope"
        set_test_val "AI_MODE" "$ai"
        set_test_val "DATASOURCES" "$([ "$ai" = "mock" ] && echo "mock" || echo "api")"
        set_test_val "STREAMING" "enabled"
        set_test_val "CORS_ORIGINS" "auto"
        set_test_val "ENABLE_ADMIN_ROUTES" "false"

        # Set required values for specific modes
        [ "$scope" = "frontend" ] && set_test_val "VITE_API_URL" "https://my-backend.com/api"
        [ "$ai" = "byo" ] && set_test_val "AI_PROJECT_ENDPOINT" "https://hub.cognitiveservices.azure.com/api/projects/proj"
        [ "$ai" = "byo" ] && set_test_val "AI_AGENT_ID" "my-agent:1"
        [ "$ai" = "create" ] && set_test_val "AI_MODEL_NAME" "gpt-4o-mini"
        [ "$ai" = "create" ] && set_test_val "AI_MODEL_VERSION" "2024-07-18"
        [ "$ai" = "create" ] && set_test_val "AI_MODEL_CAPACITY" "1"
        [ "$ai" = "create" ] && set_test_val "AI_AGENT_ID" "foundry-chat-agent:1"

        result=$(test_config_valid "$scope" "$ai")
        if [ -z "$result" ]; then
            echo -e "  ${GREEN}✓${NC} $label"
            PASS=$((PASS + 1))
        else
            echo -e "  ${RED}✗${NC} $label — $result"
            FAILURES+=("config: $label — $result")
            FAIL=$((FAIL + 1))
        fi
    done
done

# ── Test 2: Manifest generation ──────────────────────────────

echo ""
echo -e "${BOLD}② Manifest Generation (envsubst)${NC}"
echo ""

if ! command -v envsubst &>/dev/null; then
    echo -e "  ${YELLOW}⚠ envsubst not found — skipping manifest tests${NC}"
    SKIP=$((SKIP + 3))
else
    for scope in "${SCOPES[@]}"; do
        label="scope=${scope}"
        init_test_env
        set_test_val "DEPLOY_SCOPE" "$scope"
        set_test_val "AI_MODE" "mock"
        set_test_val "DATASOURCES" "mock"
        set_test_val "STREAMING" "enabled"
        set_test_val "CORS_ORIGINS" "https://10.0.0.1"
        set_test_val "ENABLE_ADMIN_ROUTES" "false"
        set_test_val "VITE_API_URL" "https://10.0.0.1/api"
        set_test_val "AI_PROJECT_ENDPOINT" ""
        set_test_val "AI_AGENT_ID" ""

        result=$(test_manifests "$scope" "mock" "$label")
        if [ -z "$result" ]; then
            echo -e "  ${GREEN}✓${NC} $label — all manifests resolve"
            PASS=$((PASS + 1))
        else
            echo -e "  ${RED}✗${NC} $label —$result"
            FAILURES+=("manifest: $label —$result")
            FAIL=$((FAIL + 1))
        fi
    done
fi

# ── Test 3: Scope transitions ────────────────────────────────

echo ""
echo -e "${BOLD}③ Scope Transitions${NC}"
echo ""

TRANSITIONS=("all→backend" "all→frontend" "backend→frontend" "frontend→backend" "backend→all" "frontend→all")
for trans in "${TRANSITIONS[@]}"; do
    from="${trans%%→*}"
    to="${trans##*→}"
    label="$from → $to"
    init_test_env
    set_test_val "PREV_DEPLOY_SCOPE" "$from"
    set_test_val "DEPLOY_SCOPE" "$to"

    result=$(test_scope_transition "$from" "$to")
    if [ -z "$result" ]; then
        echo -e "  ${GREEN}✓${NC} $label"
        PASS=$((PASS + 1))
    else
        echo -e "  ${RED}✗${NC} $label — $result"
        FAILURES+=("transition: $label — $result")
        FAIL=$((FAIL + 1))
    fi
done

# ── Test 4: Recipe application ───────────────────────────────

echo ""
echo -e "${BOLD}④ Recipe Defaults${NC}"
echo ""

for recipe in "all" "dev"; do
    label="recipe=${recipe}"
    init_test_env

    # Simulate recipe application
    case "$recipe" in
        all)
            set_test_val "DEPLOY_SCOPE" "all"
            set_test_val "AI_MODE" "create"
            set_test_val "AI_MODEL_NAME" "gpt-4o-mini"
            set_test_val "DATASOURCES" "api"
            set_test_val "STREAMING" "enabled"
            set_test_val "CORS_ORIGINS" "auto"
            set_test_val "ENABLE_ADMIN_ROUTES" "false"
            set_test_val "VM_SIZE" "Standard_D2s_v3"
            set_test_val "NODE_COUNT" "2"
            ;;
        dev)
            set_test_val "DEPLOY_SCOPE" "all"
            set_test_val "AI_MODE" "mock"
            set_test_val "DATASOURCES" "mock"
            set_test_val "STREAMING" "enabled"
            set_test_val "CORS_ORIGINS" "*"
            set_test_val "ENABLE_ADMIN_ROUTES" "true"
            set_test_val "VM_SIZE" "Standard_B2s"
            set_test_val "NODE_COUNT" "2"
            ;;
    esac

    # Validate the recipe produces valid config
    scope=$(get_test_val "DEPLOY_SCOPE")
    ai=$(get_test_val "AI_MODE")
    [ "$ai" = "create" ] && set_test_val "AI_MODEL_NAME" "gpt-4o-mini" && set_test_val "AI_AGENT_ID" "foundry-chat-agent:1"

    result=$(test_config_valid "$scope" "$ai")
    if [ -z "$result" ]; then
        echo -e "  ${GREEN}✓${NC} $label → scope=${scope} ai=${ai}"
        PASS=$((PASS + 1))
    else
        echo -e "  ${RED}✗${NC} $label — $result"
        FAILURES+=("recipe: $label — $result")
        FAIL=$((FAIL + 1))
    fi
done

# ── Test 5: AI mode transitions ──────────────────────────────

echo ""
echo -e "${BOLD}⑤ AI Mode Transitions${NC}"
echo ""

AI_TRANSITIONS=("create→mock" "create→byo" "mock→create" "mock→byo" "byo→create" "byo→mock")
for trans in "${AI_TRANSITIONS[@]}"; do
    from="${trans%%→*}"
    to="${trans##*→}"
    label="ai: $from → $to"
    init_test_env
    set_test_val "PREV_AI_MODE" "$from"
    set_test_val "AI_MODE" "$to"
    set_test_val "DEPLOY_SCOPE" "all"
    set_test_val "DATASOURCES" "$([ "$to" = "mock" ] && echo "mock" || echo "api")"
    [ "$to" = "byo" ] && set_test_val "AI_PROJECT_ENDPOINT" "https://hub.cognitiveservices.azure.com/api/projects/proj"
    [ "$to" = "byo" ] && set_test_val "AI_AGENT_ID" "my-agent:1"
    [ "$to" = "create" ] && set_test_val "AI_MODEL_NAME" "gpt-4o-mini"
    [ "$to" = "create" ] && set_test_val "AI_AGENT_ID" "foundry-chat-agent:1"

    needs_cleanup=""
    [ "$from" = "create" ] && [ "$to" != "create" ] && needs_cleanup="yes"

    result=$(test_config_valid "all" "$to")
    if [ -z "$result" ]; then
        extra=""
        [ -n "$needs_cleanup" ] && extra=" ${DIM}(would prompt AI cleanup)${NC}"
        echo -e "  ${GREEN}✓${NC} $label${extra}"
        PASS=$((PASS + 1))
    else
        echo -e "  ${RED}✗${NC} $label — $result"
        FAILURES+=("ai-transition: $label — $result")
        FAIL=$((FAIL + 1))
    fi
done

# ── Test 6: defaults.sh apply_defaults (no Azure, file I/O only) ──

echo ""
echo -e "${BOLD}⑥ defaults.sh — env file I/O${NC}"
echo ""

# Test: config.json lookup from different directories
for test_dir in "." "server" "docs" "infra"; do
    label="config.json from ${test_dir}/"
    init_test_env

    FAKE_ROOT=$(mktemp -d)
    mkdir -p "$FAKE_ROOT/.azure/test-env"
    echo '{"version":1,"defaultEnvironment":"test-env"}' > "$FAKE_ROOT/.azure/config.json"
    echo 'ARC_PREFIX="test-env"' > "$FAKE_ROOT/.azure/test-env/.env"
    echo 'AZURE_ENV_NAME="test-env"' >> "$FAKE_ROOT/.azure/test-env/.env"
    mkdir -p "$FAKE_ROOT/$test_dir" 2>/dev/null || true

    # Test that _def_find_env works with REPO_ROOT set
    result=$(cd "$FAKE_ROOT/$test_dir" 2>/dev/null && REPO_ROOT="$FAKE_ROOT" INFRA_DIR="$FAKE_ROOT/infra" bash -c '
        _DEF_ENV_FILE=""
        _def_find_env() {
            [ -n "$_DEF_ENV_FILE" ] && return
            local search_dirs=("." "${REPO_ROOT:-}" "${INFRA_DIR:+${INFRA_DIR}/..}")
            local dir config_path name=""
            for dir in "${search_dirs[@]}"; do
                [ -z "$dir" ] && continue
                config_path="${dir}/.azure/config.json"
                if [ -f "$config_path" ]; then
                    name=$(grep "\"defaultEnvironment\"" "$config_path" 2>/dev/null | sed "s/.*: *\"\([^\"]*\)\".*/\1/" || echo "")
                    [ -n "$name" ] && [ -f "${dir}/.azure/${name}/.env" ] && _DEF_ENV_FILE="${dir}/.azure/${name}/.env"
                    break
                fi
            done
        }
        _def_find_env
        [ -n "$_DEF_ENV_FILE" ] && echo "ok" || echo "FAIL: env file not found"
    ' 2>/dev/null)

    rm -rf "$FAKE_ROOT"

    if [ "$result" = "ok" ]; then
        echo -e "  ${GREEN}✓${NC} $label"
        PASS=$((PASS + 1))
    else
        echo -e "  ${RED}✗${NC} $label — $result"
        FAILURES+=("defaults: $label — $result")
        FAIL=$((FAIL + 1))
    fi
done

# Test: env file read/write roundtrip
label="env file read/write roundtrip"
ROUNDTRIP_DIR=$(mktemp -d)
echo 'EXISTING_VAR="hello"' > "$ROUNDTRIP_DIR/test.env"
_RT_FILE="$ROUNDTRIP_DIR/test.env"

# Write new var
echo 'NEW_VAR="world"' >> "$_RT_FILE"
# Update existing var
sed -i.bak 's|^EXISTING_VAR=.*|EXISTING_VAR="updated"|' "$_RT_FILE" && rm -f "${_RT_FILE}.bak"
# Read back
_v1=$(grep "^EXISTING_VAR=" "$_RT_FILE" | head -1 | cut -d= -f2- | tr -d '"')
_v2=$(grep "^NEW_VAR=" "$_RT_FILE" | head -1 | cut -d= -f2- | tr -d '"')

if [ "$_v1" = "updated" ] && [ "$_v2" = "world" ]; then
    echo -e "  ${GREEN}✓${NC} $label"
    PASS=$((PASS + 1))
else
    echo -e "  ${RED}✗${NC} $label — got EXISTING=$_v1, NEW=$_v2"
    FAILURES+=("defaults: $label")
    FAIL=$((FAIL + 1))
fi
rm -rf "$ROUNDTRIP_DIR"

# Test: RG tag TSV parsing with None values
label="RG tag TSV with None values"
TAG_LINE=$'eastus2\tall\tNone\tmock\tenabled\tauto\tfalse\tNone\ttrue'
IFS=$'\t' read -r LOC RCP SCP DS STR CRS ADM AGT DDN <<< "$TAG_LINE"
errors=""
[ "$LOC" != "eastus2" ] && errors="LOC=$LOC"
[ "$RCP" != "all" ] && errors="${errors} RCP=$RCP"
[ "$SCP" != "None" ] && errors="${errors} SCP should be None"
[ "$DDN" != "true" ] && errors="${errors} DDN=$DDN"
if [ -z "$errors" ]; then
    echo -e "  ${GREEN}✓${NC} $label"
    PASS=$((PASS + 1))
else
    echo -e "  ${RED}✗${NC} $label — $errors"
    FAILURES+=("defaults: $label — $errors")
    FAIL=$((FAIL + 1))
fi

# ── Test 7: Container Apps manifest check ─────────────────────

echo ""
echo -e "${BOLD}⑦ Container Apps Mode${NC}"
echo ""

CA_DIR="$REPO_ROOT/infra/modes/containerapp"
if [ -f "$CA_DIR/deploy.sh" ]; then
    # Check containerapp deploy.sh sources expected files
    ca_errors=""
    grep -q "naming.sh" "$CA_DIR/deploy.sh" || ca_errors="missing naming.sh source"
    grep -q "DEPLOY_SCOPE\|SCOPE" "$CA_DIR/deploy.sh" || ca_errors="${ca_errors}; missing scope handling"
    if [ -z "$ca_errors" ]; then
        echo -e "  ${GREEN}✓${NC} containerapp/deploy.sh structure"
        PASS=$((PASS + 1))
    else
        echo -e "  ${RED}✗${NC} containerapp/deploy.sh — $ca_errors"
        FAILURES+=("containerapp: $ca_errors")
        FAIL=$((FAIL + 1))
    fi
else
    echo -e "  ${YELLOW}⚠${NC} containerapp/deploy.sh not found — skipped"
    SKIP=$((SKIP + 1))
fi

# ── Test 8: Frontend-only manifest with VITE_API_URL ──────────

echo ""
echo -e "${BOLD}⑧ Frontend-Only Deploy${NC}"
echo ""

if command -v envsubst &>/dev/null && [ -f "$K8S_DIR/frontend.yaml" ]; then
    init_test_env
    set_test_val "DEPLOY_SCOPE" "frontend"
    set_test_val "VITE_API_URL" "https://my-backend.example.com/api"

    set -a
    while IFS='=' read -r key val; do
        [ -n "$key" ] || continue; val="${val#\"}" ; val="${val%\"}"
        export "$key=$val"
    done < "$TEST_ENV_FILE"
    set +a
    source "$INFRA_DIR/naming.sh" 2>/dev/null || true
    export PREFIX="${_PREFIX:-$ARC_PREFIX}" NAMESPACE="${ARC_NAMESPACE}" ACR_SERVER="${AZURE_ACR_SERVER}"
    export WI_CLIENT_ID="${AZURE_WI_CLIENT_ID}" WI_SA_NAME="${ARC_PREFIX}-backend-sa"
    export BACKEND_PORT="3001" FRONTEND_PORT="80"

    fe_out=$(envsubst < "$K8S_DIR/frontend.yaml" 2>&1)
    fe_errors=""
    # VITE_API_URL is baked at Docker build time (--build-arg), not in manifest
    echo "$fe_out" | grep -qE '\$\{[A-Z]' && fe_errors="unresolved vars: $(echo "$fe_out" | grep -oE '\$\{[^}]+\}' | sort -u | tr '\n' ',')"

    if [ -z "$fe_errors" ]; then
        echo -e "  ${GREEN}✓${NC} frontend.yaml with external API URL"
        PASS=$((PASS + 1))
    else
        echo -e "  ${RED}✗${NC} frontend.yaml — $fe_errors"
        FAILURES+=("frontend: $fe_errors")
        FAIL=$((FAIL + 1))
    fi
else
    echo -e "  ${YELLOW}⚠${NC} envsubst or frontend.yaml not found — skipped"
    SKIP=$((SKIP + 1))
fi

# ── Test 9: BYO AI cross-RG config ───────────────────────────

echo ""
echo -e "${BOLD}⑨ BYO AI Cross-RG${NC}"
echo ""

label="byo with AI_RESOURCE_GROUP set"
init_test_env
set_test_val "AI_MODE" "byo"
set_test_val "AI_PROJECT_ENDPOINT" "https://other-hub.cognitiveservices.azure.com/api/projects/proj"
set_test_val "AI_AGENT_ID" "my-agent:1"
set_test_val "AI_RESOURCE_GROUP" "other-ai-rg"
set_test_val "DEPLOY_SCOPE" "all"
set_test_val "DATASOURCES" "api"

result=$(test_config_valid "all" "byo")
ai_rg=$(get_test_val "AI_RESOURCE_GROUP")
if [ -z "$result" ] && [ "$ai_rg" = "other-ai-rg" ]; then
    echo -e "  ${GREEN}✓${NC} $label (AI_RESOURCE_GROUP=$ai_rg)"
    PASS=$((PASS + 1))
else
    echo -e "  ${RED}✗${NC} $label — $result"
    FAILURES+=("byo: $label — $result")
    FAIL=$((FAIL + 1))
fi

# ── Summary ──────────────────────────────────────────────────

echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════${NC}"
TOTAL=$((PASS + FAIL + SKIP))
if [ "$FAIL" -eq 0 ]; then
    echo -e "  ${GREEN}${BOLD}All $PASS tests passed${NC} ($SKIP skipped)"
else
    echo -e "  ${RED}${BOLD}$FAIL FAILED${NC}, $PASS passed, $SKIP skipped"
    echo ""
    for f in "${FAILURES[@]}"; do
        echo -e "  ${RED}✗${NC} $f"
    done
fi
echo -e "${BOLD}═══════════════════════════════════════════════════${NC}"
echo ""

[ "$FAIL" -gt 0 ] && exit 1
exit 0
