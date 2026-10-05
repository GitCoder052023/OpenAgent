#!/usr/bin/env bash
# ==============================================================================
# OpenAgent Single-Command Mac Launcher
# ==============================================================================
# Delegates directly to the autonomous Python boot engine (boot.py) which handles:
# 1. Self-bootstrapping virtual environment via uv
# 2. Dependency auto-installation & module synchronization
# 3. Model auto-provisioning (Whisper & Vosk)
# 4. macOS Accessibility permission handling
# 5. WhatsApp Desktop background lifecycle management
# 6. Preflight harness verification & autonomous supervisor watchdog
# ==============================================================================

set -euo pipefail

# Ensure standard Homebrew & Bun paths are active on macOS
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.bun/bin:$HOME/.local/bin:$PATH"

# Resolve repo root directory regardless of where script is called from
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec python3 "$ROOT_DIR/boot.py" "$@"
