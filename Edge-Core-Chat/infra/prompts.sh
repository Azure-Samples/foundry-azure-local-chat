#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# prompts.sh — Shared interactive prompt library
# ═══════════════════════════════════════════════════════════════
# Source this file from any hook script to get TUI helpers:
#   get_val, save_val, save_cached, flush_env, set_default, section,
#   prompt_val, prompt_choice, prompt_select, prompt_search,
#   az_fetch_list, check_model_quota
#
# Works on any bash/sh — no bash 4+ required.
# Env vars: AUTO_YES — when "true", skip all interactive prompts
# ═══════════════════════════════════════════════════════════════

# Colors (safe to re-source)
CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'
DIM='\033[2m'; BOLD='\033[1m'; MAGENTA='\033[0;35m'; NC='\033[0m'

# ═══════════════════════════════════════════════════════════════
# Environment cache — reads/writes .azure/<env>/.env directly
# ═══════════════════════════════════════════════════════════════
# No associative arrays, no bash 4+ needed.
# get_val  — grep from .env file
# save_val — update .env file immediately
# save_cached — update .env file (same as save_val, no CLI)
# flush_env — no-op (writes are immediate)

_ENV_FILE=""
_env_init() {
    if [ -n "$_ENV_FILE" ]; then return; fi
    local search_dirs=("." "${REPO_ROOT:-}" "${INFRA_DIR:+${INFRA_DIR}/..}")
    local dir config_path ENV_NAME=""
    for dir in "${search_dirs[@]}"; do
        [ -z "$dir" ] && continue
        config_path="${dir}/.azure/config.json"
        if [ -f "$config_path" ]; then
            ENV_NAME=$(grep '"defaultEnvironment"' "$config_path" 2>/dev/null | sed 's/.*: *"\([^"]*\)".*/\1/' || echo "")
            [ -n "$ENV_NAME" ] && [ -f "${dir}/.azure/${ENV_NAME}/.env" ] && _ENV_FILE="${dir}/.azure/${ENV_NAME}/.env"
            break
        fi
    done
}
_env_init

get_val() {
    [ -z "$_ENV_FILE" ] && { azd env get-value "$1" 2>/dev/null || echo ""; return; }
    local val
    val=$(grep "^${1}=" "$_ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2-)
    val="${val#\"}" ; val="${val%\"}"
    echo "$val"
}

save_val() {
    if [ -z "$_ENV_FILE" ]; then
        azd env set "$1" "$2" 2>/dev/null || true
        return
    fi
    # Remove existing line and append new one
    if grep -q "^${1}=" "$_ENV_FILE" 2>/dev/null; then
        sed -i.bak "s|^${1}=.*|${1}=\"${2}\"|" "$_ENV_FILE" && rm -f "${_ENV_FILE}.bak"
    else
        echo "${1}=\"${2}\"" >> "$_ENV_FILE"
    fi
}

save_cached() { save_val "$1" "$2"; }  # same as save_val — writes are immediate
flush_env()   { true; }                # no-op — all writes are immediate
set_default() { [ -z "$(get_val "$1")" ] && save_val "$1" "$2" || true; }

# ═══════════════════════════════════════════════════════════════
# Section helper — print a bold section header
# ═══════════════════════════════════════════════════════════════

section() { echo ""; echo -e "  ${BOLD}${YELLOW}$1${NC}"; [ -n "${2:-}" ] && echo -e "  ${DIM}$2${NC}"; echo ""; }

# ═══════════════════════════════════════════════════════════════
# prompt_val — free-text input
# ═══════════════════════════════════════════════════════════════
# Usage: prompt_val VAR "Label" "default" [--required] ["help"]

prompt_val() {
    local VAR="$1" LABEL="$2" DEFAULT="${3:-}" REQUIRED="${4:-}" HELP="${5:-}"
    local CURRENT; CURRENT="$(get_val "$VAR")"
    if [ "$AUTO_YES" = "true" ]; then
        [ -n "$CURRENT" ] && return
        if [ -n "$DEFAULT" ]; then save_val "$VAR" "$DEFAULT"; return; fi
        [ "$REQUIRED" = "--required" ] && { echo -e "  ${RED}❌ $VAR required. azd env set $VAR \"<value>\"${NC}"; exit 1; }
        return
    fi
    [ -n "$HELP" ] && echo -e "  ${DIM}$HELP${NC}"
    local SHOW="${CURRENT:-$DEFAULT}"
    echo -ne "  ${LABEL}${SHOW:+ ${DIM}[${SHOW}]${NC}}: ${CYAN}"
    read -r INPUT; echo -ne "${NC}"
    INPUT=$(echo "$INPUT" | tr -d '[:cntrl:]')  # strip escape sequences from arrow keys
    local VALUE="${INPUT:-${CURRENT:-$DEFAULT}}"
    if [ -z "$VALUE" ] && [ "$REQUIRED" = "--required" ]; then
        echo -e "  ${RED}Required. Please enter a value.${NC}"; prompt_val "$@"; return
    fi
    [ -n "$VALUE" ] && save_val "$VAR" "$VALUE"
}

# ═══════════════════════════════════════════════════════════════
# prompt_choice — arrow-key selector for static options
# ═══════════════════════════════════════════════════════════════
# Usage: prompt_choice VAR "Label" "val1|desc1" "val2|desc2" ...
# Keys:  ↑/↓ navigate, Enter select, 1-9 quick-pick

prompt_choice() {
    local VAR="$1" LABEL="$2"; shift 2
    local RAW=("$@") VALUES=() DESCS=()
    for opt in "${RAW[@]}"; do VALUES+=("${opt%%|*}"); DESCS+=("${opt#*|}"); done
    local CURRENT; CURRENT="$(get_val "$VAR")"
    if [ "$AUTO_YES" = "true" ]; then [ -n "$CURRENT" ] && return; save_val "$VAR" "${VALUES[0]}"; return; fi

    # Pre-select current value
    local SEL=0
    if [ -n "$CURRENT" ]; then
        for i in "${!VALUES[@]}"; do [ "${VALUES[$i]}" = "$CURRENT" ] && SEL=$i; done
    fi

    local COUNT=${#VALUES[@]}
    echo -e "  ${LABEL} ${DIM}(↑/↓ to move, Enter to select)${NC}"

    _draw_choices() {
        for i in "${!VALUES[@]}"; do
            local MARKER=""
            [ -n "$CURRENT" ] && [ "${VALUES[$i]}" = "$CURRENT" ] && MARKER=" ${CYAN}← current${NC}"
            if [ "$i" -eq "$SEL" ]; then
                echo -e "  ${GREEN}❯ ${VALUES[$i]}${NC} — ${DESCS[$i]}${MARKER}"
            else
                echo -e "    ${VALUES[$i]} ${DIM}— ${DESCS[$i]}${NC}${MARKER}"
            fi
        done
    }

    _draw_choices

    while true; do
        IFS= read -rsn1 KEY
        case "$KEY" in
            $'\x1b')  # Arrow keys
                read -rsn2 SEQ
                case "$SEQ" in
                    '[A') SEL=$(( (SEL - 1 + COUNT) % COUNT )) ;;
                    '[B') SEL=$(( (SEL + 1) % COUNT )) ;;
                esac
                printf "\033[${COUNT}A"
                _draw_choices
                ;;
            '') break ;;  # Enter
            [1-9])      # Number quick-pick
                local NUM=$((KEY - 1))
                if [ "$NUM" -ge 0 ] && [ "$NUM" -lt "$COUNT" ]; then
                    SEL=$NUM
                    printf "\033[${COUNT}A"
                    _draw_choices
                    break
                fi
                ;;
        esac
    done

    save_val "$VAR" "${VALUES[$SEL]}"
    echo ""
}

# ═══════════════════════════════════════════════════════════════
# prompt_select — arrow-key selector for dynamic lists
# ═══════════════════════════════════════════════════════════════
# Usage: prompt_select VAR "Label" VALUES_ARRAY DISPLAY_ARRAY ["help"] ["default"]
# Keys:  ↑/↓ navigate, Enter select, Esc go back, 0-9 quick-pick
# Sets VAR to "__back__" if Esc pressed.

prompt_select() {
    local VAR="$1" LABEL="$2" VNAME="$3" DNAME="$4" HELP="${5:-}" DEFAULT="${6:-}"
    eval "_SV=(\"\${${VNAME}[@]}\")"; eval "_SD=(\"\${${DNAME}[@]}\")"
    local CURRENT; CURRENT="$(get_val "$VAR")"
    if [ "$AUTO_YES" = "true" ]; then
        [ -n "$CURRENT" ] && return
        if [ -n "$DEFAULT" ]; then save_val "$VAR" "$DEFAULT"; return; fi
        [ "${#_SV[@]}" -gt 0 ] && save_val "$VAR" "${_SV[0]}"; return
    fi
    [ -n "$HELP" ] && echo -e "  ${DIM}$HELP${NC}"

    local COUNT=${#_SV[@]}
    local SEL=0  # position on current value, default, or first item
    if [ -n "$CURRENT" ]; then
        for i in "${!_SV[@]}"; do [ "${_SV[$i]}" = "$CURRENT" ] && SEL=$i; done
    elif [ -n "$DEFAULT" ]; then
        for i in "${!_SV[@]}"; do [ "${_SV[$i]}" = "$DEFAULT" ] && SEL=$i; done
    fi

    echo -e "  ${LABEL} ${DIM}(↑/↓ move, Enter select, Esc back)${NC}"

    _draw_select() {
        for i in "${!_SV[@]}"; do
            local MARKER=""
            [ -n "$CURRENT" ] && [ "${_SV[$i]}" = "$CURRENT" ] && MARKER=" ${CYAN}← current${NC}"
            if [ "$i" -eq "$SEL" ]; then
                echo -e "  ${GREEN}❯ ${_SD[$i]}${NC}${MARKER}"
            else
                echo -e "    ${_SD[$i]}${MARKER}"
            fi
        done
    }

    _draw_select

    local NUM_BUF=""
    while true; do
        IFS= read -rsn1 KEY
        case "$KEY" in
            $'\x1b')
                read -rsn1 -t 0.1 NEXT || NEXT=""
                if [ "$NEXT" = "[" ]; then
                    read -rsn1 SEQ
                    case "$SEQ" in
                        'A') SEL=$(( (SEL - 1 + COUNT) % COUNT )) ;;
                        'B') SEL=$(( (SEL + 1) % COUNT )) ;;
                    esac
                    printf "\033[${COUNT}A"
                    _draw_select
                else  # Pure Esc — go back
                    printf "\033[${COUNT}A"
                    for i in "${!_SV[@]}"; do printf "\033[2K\n"; done
                    printf "\033[${COUNT}A"
                    save_val "$VAR" "__back__"
                    return
                fi
                ;;
            '') break ;;  # Enter
            [0-9])      # Number keys — accumulate digits for multi-digit indices
                NUM_BUF="${NUM_BUF}${KEY}"
                local IDX=$((NUM_BUF - 1))
                if [ "$IDX" -ge 0 ] && [ "$IDX" -lt "$COUNT" ]; then
                    SEL=$IDX
                    printf "\033[${COUNT}A"
                    _draw_select
                fi
                # Reset buffer when no further valid match is possible
                if [ "${#NUM_BUF}" -ge 2 ] || [ "$((NUM_BUF * 10))" -gt "$COUNT" ]; then
                    NUM_BUF=""
                fi
                ;;
            *)
                NUM_BUF=""
                ;;
        esac
    done

    save_val "$VAR" "${_SV[$SEL]}"
    echo ""
}

# ═══════════════════════════════════════════════════════════════
# prompt_search — type-to-filter for long lists
# ═══════════════════════════════════════════════════════════════
# Usage: prompt_search VAR "Label" VALUES_ARRAY DISPLAY_ARRAY ["help"]
# Type a substring to filter, then pick by number.

prompt_search() {
    local VAR="$1" LABEL="$2" VNAME="$3" DNAME="$4" HELP="${5:-}"
    eval "_SV=(\"\${${VNAME}[@]}\")"; eval "_SD=(\"\${${DNAME}[@]}\")"
    local CURRENT; CURRENT="$(get_val "$VAR")"
    if [ "$AUTO_YES" = "true" ]; then [ -n "$CURRENT" ] && return; [ "${#_SV[@]}" -gt 0 ] && save_val "$VAR" "${_SV[0]}"; return; fi
    [ -n "$HELP" ] && echo -e "  ${DIM}$HELP${NC}"

    local FILTER_HINT="${6:-type to filter}"

    while true; do
        echo -ne "  ${LABEL} ${DIM}(${FILTER_HINT})${NC}: ${CYAN}"
        read -r FILTER; echo -ne "${NC}"

        if [ -z "$FILTER" ] && [ -n "$CURRENT" ]; then
            echo -e "  Keeping: ${CYAN}${CURRENT}${NC}"; echo ""
            return
        fi

        local MATCH_V=() MATCH_D=()
        for i in "${!_SV[@]}"; do
            if [ -z "$FILTER" ] || echo "${_SV[$i]} ${_SD[$i]}" | grep -iq "$FILTER"; then
                MATCH_V+=("${_SV[$i]}")
                MATCH_D+=("${_SD[$i]}")
            fi
        done

        if [ "${#MATCH_V[@]}" -eq 0 ]; then
            echo -e "  ${YELLOW}No matches for '${FILTER}'. Try again.${NC}"
            continue
        elif [ "${#MATCH_V[@]}" -eq 1 ]; then
            save_val "$VAR" "${MATCH_V[0]}"
            echo -e "  Selected: ${CYAN}${MATCH_V[0]}${NC}"; echo ""
            return
        fi

        for i in "${!MATCH_V[@]}"; do
            echo -e "    ${BOLD}$((i+1)))${NC} ${MATCH_D[$i]}"
        done
        echo -ne "  Choice ${DIM}[1]${NC}: ${CYAN}"; read -r CHOICE; echo -ne "${NC}"
        [ -z "$CHOICE" ] && CHOICE=1
        if [[ "$CHOICE" =~ ^[0-9]+$ ]] && [ "$CHOICE" -ge 1 ] && [ "$CHOICE" -le "${#MATCH_V[@]}" ]; then
            save_val "$VAR" "${MATCH_V[$((CHOICE-1))]}"
            echo ""
            return
        else
            echo -e "  ${YELLOW}Invalid choice. Try again.${NC}"
        fi
    done
}

# ═══════════════════════════════════════════════════════════════
# az_fetch_list — fetch Azure data with timeout
# ═══════════════════════════════════════════════════════════════
# Usage: az_fetch_list VALS_NAME DISP_NAME "az command" "python script" ["loading msg"] [timeout_secs]
# Populates two arrays (values + display labels) from an az CLI query.

az_fetch_list() {
    local VALS_NAME="$1" DISP_NAME="$2" AZ_CMD="$3" PY_SCRIPT="$4" LOADING_MSG="${5:-Loading...}" TIMEOUT="${6:-15}"
    echo -ne "  ${DIM}${LOADING_MSG}${NC}\r"
    eval "${VALS_NAME}=()"
    eval "${DISP_NAME}=()"
    local TMPFILE; TMPFILE=$(mktemp)
    ( eval "$AZ_CMD" 2>/dev/null | python3 -c "$PY_SCRIPT" 2>/dev/null > "$TMPFILE" ) &  # run with timeout
    local PID=$!
    local WAITED=0
    while kill -0 "$PID" 2>/dev/null && [ "$WAITED" -lt "$TIMEOUT" ]; do
        sleep 1; WAITED=$((WAITED + 1))
    done
    if kill -0 "$PID" 2>/dev/null; then
        kill "$PID" 2>/dev/null; wait "$PID" 2>/dev/null
        echo -ne "  ${YELLOW}Timed out after ${TIMEOUT}s${NC}                \r"
    fi
    while IFS='|' read -r val disp; do
        [ -n "$val" ] || continue
        eval "${VALS_NAME}+=(\"$val\")"
        eval "${DISP_NAME}+=(\"${val} ${DIM}— ${disp}${NC}\")"
    done < "$TMPFILE"
    rm -f "$TMPFILE"
    echo -ne "                                           \r"
}

# ═══════════════════════════════════════════════════════════════
# check_model_quota — validate TPM quota for a model deployment
# ═══════════════════════════════════════════════════════════════
# Usage: check_model_quota LOCATION MODEL_NAME DEPLOYMENT_SKU CAPACITY CAPACITY_VAR
# Returns 0 if quota is sufficient (or auto-adjusted), 1 if unavailable.

check_model_quota() {
    local LOCATION="$1" MODEL="$2" SKU="${3:-GlobalStandard}" CAPACITY="$4" CAP_VAR="${5:-AI_MODEL_CAPACITY}"
    local MODEL_TYPE="OpenAI.${SKU}.${MODEL}"

    echo -ne "  ${DIM}Checking quota for ${MODEL} in ${LOCATION}...${NC}"

    local USAGE_JSON
    USAGE_JSON=$(az cognitiveservices usage list --location "$LOCATION" \
        --query "[?name.value=='$MODEL_TYPE']" -o json 2>/dev/null || echo "[]")

    if [ "$USAGE_JSON" = "[]" ] || [ -z "$USAGE_JSON" ]; then
        echo -e " ${YELLOW}no quota info found (will try anyway)${NC}"
        return 0
    fi

    local CURRENT_VAL LIMIT_VAL
    CURRENT_VAL=$(echo "$USAGE_JSON" | python3 -c "import sys,json;d=json.load(sys.stdin);print(int(d[0].get('currentValue',0)))" 2>/dev/null || echo "0")
    LIMIT_VAL=$(echo "$USAGE_JSON" | python3 -c "import sys,json;d=json.load(sys.stdin);print(int(d[0].get('limit',0)))" 2>/dev/null || echo "0")

    local AVAILABLE=$((LIMIT_VAL - CURRENT_VAL))
    echo -e " ${GREEN}available: ${AVAILABLE}K TPM${NC} ${DIM}(used: ${CURRENT_VAL}, limit: ${LIMIT_VAL})${NC}"

    if [ "$AVAILABLE" -lt "$CAPACITY" ]; then
        if [ "$AVAILABLE" -ge 1 ]; then
            echo -e "  ${YELLOW}⚠ Requested ${CAPACITY}K TPM but only ${AVAILABLE}K available.${NC}"
            if [ "$AUTO_YES" = "true" ]; then
                save_val "$CAP_VAR" "$AVAILABLE"
                echo -e "  ${DIM}Auto-reduced capacity to ${AVAILABLE}K TPM.${NC}"
            else
                prompt_val "$CAP_VAR" "Adjusted capacity (1-${AVAILABLE})" "$AVAILABLE" --required \
                    "Enter a capacity between 1 and ${AVAILABLE} (in thousands TPM)"
            fi
        else
            echo -e "  ${RED}❌ No quota available for ${MODEL} in ${LOCATION}.${NC}"
            echo -e "  ${DIM}Try a different region or model.${NC}"
            return 1
        fi
    else
        echo -e "  ${GREEN}✅ Sufficient quota${NC} ${DIM}(requested: ${CAPACITY}K, available: ${AVAILABLE}K)${NC}"
    fi
    return 0
}
