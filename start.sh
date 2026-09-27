#!/usr/bin/env bash
# ==============================================================================
# Jarvis Bridge Single-Command Mac Launcher
# ==============================================================================
# Spins up the complete Jarvis Bridge system:
# 1. Verifies environment (Python venv, Bun, Ripgrep, Node modules)
# 2. Ensures WhatsApp Desktop is open and backgrounded
# 3. Runs an instant preflight test on the OpenCode execution harness
# 4. Starts the push-to-talk voice/text bridge with real-time tool execution
# ==============================================================================

set -euo pipefail

# Ensure standard Homebrew & Bun paths are active on macOS
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.bun/bin:$PATH"

# Resolve repo root directory regardless of where script is called from
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

# Visual formatting
BOLD="\033[1m"
GREEN="\033[0;32m"
BLUE="\033[0;34m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
RESET="\033[0m"

echo -e "${BOLD}${BLUE}"
echo "========================================================"
echo "          ⚡ JARVIS BRIDGE - MAC SYSTEM LAUNCHER         "
echo "========================================================"
echo -e "${RESET}"

# 1. OS Check
if [[ "$(uname -s)" != "Darwin" ]]; then
    echo -e "${RED}[ERROR] Jarvis Bridge requires macOS Darwin for AX automation.${RESET}"
    exit 1
fi

# 2. Dependency Checks
echo -e "${BOLD}[1/4] Checking system dependencies...${RESET}"

if ! command -v bun &>/dev/null; then
    echo -e "${RED}[ERROR] 'bun' not found. Please install Bun: curl -fsSL https://bun.sh/install | bash${RESET}"
    exit 1
fi
echo -e "  ${GREEN}✓${RESET} Bun runtime: $(bun --version)"

if ! command -v rg &>/dev/null; then
    echo -e "${YELLOW}[WARN] 'rg' (Ripgrep) not found in PATH. File search might be degraded.${RESET}"
    echo -e "       Install via: brew install ripgrep"
else
    echo -e "  ${GREEN}✓${RESET} Ripgrep: $(rg --version | head -n 1)"
fi

# 3. Python Virtualenv & Configuration Check
echo -e "${BOLD}[2/4] Verifying Python environment & configuration...${RESET}"
if [[ ! -f ".venv/bin/python3" ]]; then
    echo -e "  ${YELLOW}!${RESET} Virtualenv not found. Creating .venv..."
    python3 -m venv .venv
    .venv/bin/pip install --upgrade pip
    .venv/bin/pip install -e .
fi
echo -e "  ${GREEN}✓${RESET} Python virtualenv: $(.venv/bin/python3 --version)"

# If --voice mode is requested, ensure voice dependencies and offline model are present
if [[ " $* " =~ " --voice " ]]; then
    if ! .venv/bin/python3 -c "import sounddevice, vosk" 2>/dev/null; then
        echo -e "  ${YELLOW}!${RESET} Installing voice dependencies (sounddevice, vosk)..."
        .venv/bin/pip install sounddevice vosk
    fi
    if [[ ! -d "models/vosk-model-small-en-us-0.15" ]]; then
        echo -e "  ${YELLOW}!${RESET} Downloading offline Vosk model for voice wake-phrase mode..."
        mkdir -p models
        curl -L -s https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip -o models/vosk-model.zip
        unzip -q -o models/vosk-model.zip -d models/
        rm -f models/vosk-model.zip
    fi
    echo -e "  ${GREEN}✓${RESET} Voice mode offline model & audio libraries ready"
fi

if [[ ! -f ".env" ]]; then
    if [[ -f ".env.example" ]]; then
        echo -e "  ${YELLOW}!${RESET} .env not found. Initializing from .env.example..."
        cp .env.example .env
    else
        echo -e "${RED}[ERROR] Neither .env nor .env.example found.${RESET}"
        exit 1
    fi
fi
echo -e "  ${GREEN}✓${RESET} Configuration (.env) loaded"

# 4. Harness & TypeScript Modules
echo -e "${BOLD}[3/4] Testing OpenCode headless execution harness...${RESET}"
if [[ ! -d "opencode/node_modules" ]]; then
    echo -e "  ${YELLOW}!${RESET} Installing opencode dependencies with Bun..."
    (cd opencode && bun install)
fi

# Run instant IPC preflight check
if .venv/bin/python3 -c "from bridge.harness import OpenCodeHarness; h=OpenCodeHarness(); h.system_info(); h.close()" 2>/dev/null; then
    echo -e "  ${GREEN}✓${RESET} Headless harness IPC operational (bash, read, write, edit, applescript, grep, glob)"
else
    echo -e "${RED}[ERROR] Failed to start OpenCode harness over stdio IPC.${RESET}"
    exit 1
fi

# 5. WhatsApp Desktop Status
echo -e "${BOLD}[4/4] Ensuring WhatsApp Desktop is active...${RESET}"
if ! pgrep -il "whatsapp" >/dev/null 2>&1; then
    echo -e "  ${BLUE}→${RESET} Launching WhatsApp Desktop in background..."
    open -g -j -a WhatsApp 2>/dev/null || open -g -j /Applications/*WhatsApp*.app 2>/dev/null || true
    sleep 1.5
fi

# Ensure WhatsApp is hidden to keep user screen clean
osascript -e 'tell application "System Events" to set visible of (every process whose name contains "WhatsApp") to false' 2>/dev/null || true
echo -e "  ${GREEN}✓${RESET} WhatsApp Desktop ready & backgrounded"

echo -e "\n${BOLD}${GREEN}========================================================"
echo "          🚀 SYSTEM ONLINE & READY FOR JARVIS          "
echo -e "========================================================${RESET}"
echo -e "• Hotkey: ${BOLD}Hold F8${RESET} to talk; release to send (Esc to exit)"
echo -e "• WhatsApp: Screen clean / backgrounded"
echo -e "• Harness: Intercepting & executing incoming tool calls automatically"
echo -e "--------------------------------------------------------\n"

# Execute bridge runner with any extra arguments passed into this script
exec .venv/bin/python3 -m bridge.main run "$@"
