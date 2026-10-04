#!/usr/bin/env bash
# ==============================================================================
# Jarvis Bridge Single-Command Mac Launcher
# ==============================================================================
# Spins up the complete Jarvis Bridge system:
# 1. Verifies environment (Python venv, Bun, Ripgrep, Node modules)
# 2. Ensures WhatsApp Desktop is open and backgrounded
# 3. Runs an instant preflight test on the headless execution harness
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
    echo -e "${RED}[ERROR] OpenAgent requires macOS Darwin for AX automation.${RESET}"
    exit 1
fi

# 2. Dependency Checks
echo -e "${BOLD}[1/4] Checking system dependencies...${RESET}"

if ! command -v python3 &>/dev/null; then
    echo -e "${RED}[ERROR] 'python3' not found. Please install Python 3.11+: brew install python${RESET}"
    exit 1
fi

if ! command -v bun &>/dev/null; then
    echo -e "${RED}[ERROR] 'bun' not found. Please install Bun: curl -fsSL https://bun.sh/install | bash${RESET}"
    exit 1
fi
echo -e "  ${GREEN}✓${RESET} Bun runtime: $(bun --version)"

if ! command -v rec &>/dev/null && ! command -v sox &>/dev/null; then
    echo -e "${RED}[ERROR] 'sox'/'rec' not found. Audio recording requires SoX: brew install sox${RESET}"
    exit 1
fi
echo -e "  ${GREEN}✓${RESET} SoX audio recording utility operational"

if ! command -v ffmpeg &>/dev/null; then
    echo -e "${RED}[ERROR] 'ffmpeg' not found. Voice note encoding requires ffmpeg: brew install ffmpeg${RESET}"
    exit 1
fi
echo -e "  ${GREEN}✓${RESET} ffmpeg: $(ffmpeg -version 2>/dev/null | head -n 1)"

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
    .venv/bin/pip install -e '.[dev,voice]' -e ./src/macos-harness
fi
echo -e "  ${GREEN}✓${RESET} Python virtualenv: $(.venv/bin/python3 --version)"

# Ensure local macos-harness package is installed in virtualenv
if ! .venv/bin/python3 -c "import macos_harness" 2>/dev/null; then
    echo -e "  ${YELLOW}!${RESET} Installing local macos-harness package..."
    .venv/bin/pip install -e ./src/macos-harness
fi

# If --voice mode is requested, ensure voice dependencies and offline model are present
if [[ " $* " =~ " --voice " ]]; then
    if ! .venv/bin/python3 -c "import sounddevice, vosk" 2>/dev/null; then
        echo -e "  ${YELLOW}!${RESET} Installing voice dependencies (sounddevice, vosk)..."
        .venv/bin/pip install sounddevice "vosk>=0.3.44"
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

# If text send mode is requested or configured, verify whisper-cli and model
if [[ " $* " =~ " --send-mode text " ]] || grep -qE '^BRIDGE_SEND_MODE=text' .env 2>/dev/null; then
    if ! command -v whisper-cli &>/dev/null; then
        echo -e "${YELLOW}[WARN] 'whisper-cli' not found in PATH for on-device STT.${RESET}"
        echo -e "       Install via: brew install whisper-cpp"
    fi
    if [[ ! -f "models/ggml-base.bin" ]]; then
        echo -e "  ${YELLOW}!${RESET} Whisper model (models/ggml-base.bin) not found. Downloading base model..."
        bash scripts/download-model.sh base || true
    fi
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
echo -e "${BOLD}[3/4] Testing execution harnesses...${RESET}"
if [[ ! -d "src/harness/node_modules" ]]; then
    echo -e "  ${YELLOW}!${RESET} Installing harness dependencies with Bun..."
    (cd src/harness && bun install)
fi

# Run instant IPC preflight check for Bun headless harness
if .venv/bin/python3 -c "from OpenAgent.harness import Harness; h=Harness(); h.system_info(); h.close()" 2>/dev/null; then
    echo -e "  ${GREEN}✓${RESET} Headless Bun harness IPC operational (bash, read, write, edit, applescript, grep, glob)"
else
    echo -e "${RED}[ERROR] Failed to start execution harness over stdio IPC.${RESET}"
    exit 1
fi

# Run preflight check for native macOS computer-use harness
if .venv/bin/python3 -c "from OpenAgent.mac_adapter import MacAdapter; MacAdapter()" 2>/dev/null; then
    echo -e "  ${GREEN}✓${RESET} Native macOS computer-use harness operational (vision, clicks, keys, Chrome CDP)"
else
    echo -e "  ${YELLOW}[WARN] Native macOS computer-use harness could not initialize.${RESET}"
fi

# Check macOS Accessibility permission (required to inspect WhatsApp UI and capture hotkeys)
if ! .venv/bin/python3 -c "from ApplicationServices import AXIsProcessTrusted; assert AXIsProcessTrusted() is True" 2>/dev/null; then
    echo -e "  ${RED}✗ [PERMISSION REQUIRED]${RESET} Accessibility permission is missing for this terminal!"
    echo -e "    macOS blocks untrusted processes from inspecting WhatsApp UI and intercepting tool calls."
    echo -e "    ${BOLD}Grant access in:${RESET} System Settings → Privacy & Security → Accessibility"
    echo -e "    Toggle ON ${BOLD}${TERM_PROGRAM:-Terminal}${RESET} (or add your terminal app with '+')."
    .venv/bin/python3 -c "from ApplicationServices import AXIsProcessTrustedWithOptions, kAXTrustedCheckOptionPrompt; AXIsProcessTrustedWithOptions({kAXTrustedCheckOptionPrompt: True})" 2>/dev/null || true
    echo -e "    ${YELLOW}After enabling, restart: ./start.sh${RESET}"
    exit 1
fi
echo -e "  ${GREEN}✓${RESET} macOS Accessibility trusted (WhatsApp UI inspection online)"


# 5. WhatsApp Desktop Status
echo -e "${BOLD}[4/4] Ensuring WhatsApp Desktop is active...${RESET}"
if ! pgrep -il "whatsapp" >/dev/null 2>&1; then
    echo -e "  ${BLUE}→${RESET} Launching WhatsApp Desktop in background..."
    open -g -j -a WhatsApp 2>/dev/null || open -g -j /Applications/*WhatsApp*.app 2>/dev/null || true
    sleep 1.5
fi

# Ensure WhatsApp is hidden to keep user screen clean
if pgrep -il "whatsapp" >/dev/null 2>&1; then
    osascript -e 'tell application "System Events" to set visible of (every process whose name contains "WhatsApp") to false' 2>/dev/null || true
    echo -e "  ${GREEN}✓${RESET} WhatsApp Desktop ready & backgrounded"
else
    echo -e "  ${YELLOW}[WARN] WhatsApp Desktop is not running.${RESET}"
    echo -e "         Please start WhatsApp Desktop, log in, and open the chat with your assistant."
fi

echo -e "\n${BOLD}${GREEN}========================================================"
echo "          🚀 SYSTEM ONLINE & READY FOR JARVIS          "
echo -e "========================================================${RESET}"
echo -e "• Hotkey: ${BOLD}Hold F8${RESET} to talk; release to send (Esc to exit)"
echo -e "• WhatsApp: Screen clean / backgrounded"
echo -e "• Harness: Intercepting & executing incoming tool calls automatically"
echo -e "--------------------------------------------------------\n"

# Execute bridge runner with any extra arguments passed into this script
exec .venv/bin/python3 -m OpenAgent.main run "$@"
