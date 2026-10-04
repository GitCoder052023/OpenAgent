<img src="https://raw.githubusercontent.com/browser-use/macos-harness/main/static/banner-ink.svg" alt="macOS Harness" width="100%" />

# OpenAgent ⌘

**The open-source, local macOS computer-use body for AI agents.**

[![macOS](https://img.shields.io/badge/platform-macOS%20Darwin-lightgrey.svg?style=flat-square&logo=apple)](https://apple.com)
[![Python](https://img.shields.io/badge/python-3.11%2B-blue.svg?style=flat-square&logo=python)](https://www.python.org/)
[![Bun](https://img.shields.io/badge/runtime-bun-black.svg?style=flat-square&logo=bun)](https://bun.sh)
[![Tests](https://img.shields.io/badge/tests-125%20passing-brightgreen.svg?style=flat-square)]()
[![License: MIT](https://img.shields.io/badge/license-MIT-purple.svg?style=flat-square)](LICENSE)
[![Status](https://img.shields.io/badge/status-active%20beta-orange.svg?style=flat-square)]()

<p align="center">
  <a href="#quick-start">Quick Start</a> •
  <a href="#how-it-works">How It Works</a> •
  <a href="#core-features">Features</a> •
  <a href="#tool-suite">Tool Suite</a> •
  <a href="#configuration">Configuration</a> •
  <a href="#documentation">Docs</a> •
  <a href="#contributing">Contributing</a>
</p>

## What is OpenAgent?

Remote conversational AI assistants like [Instinct](https://instinct.com/) are intelligent reasoning engines, but they are **trapped inside messaging threads**. They can explain how to fix a codebase or organize a folder, but they cannot see your screen, run a command, click a button, or operate your Mac.

**OpenAgent gives conversational AI a native macOS body.**

Running 100% locally on your Mac, OpenAgent intercepts structured tool calls from your assistant, executes native macOS actions (shell commands, file edits, accessibility inspection, window capture, keyboard/mouse input), and returns the results back into the conversation in real time.

```text
┌────────────────────────────────────────────────────────┐
│                  Instinct (The Mind)                   │
│         Reasoning • Planning • Dialogue Logic          │
└───────────────────────────┬────────────────────────────┘
                            │
                            │ Secure JARVIS_CALL transport
                            ▼
┌────────────────────────────────────────────────────────┐
│                  OpenAgent (The Body)                  │
│       Voice Pipeline • Safety Guard • Harness IPC      │
└─────────────┬────────────────────────────┬─────────────┘
              │                            │
              ▼                            ▼
┌──────────────────────────┐  ┌──────────────────────────┐
│  Headless Dev Harness    │  │ Native Computer-Use      │
│  (Bun / TypeScript)      │  │ (macOS APIs / CDP)       │
│  Terminal • Files • Code │  │ UI • Clicks • Chrome • AX│
└─────────────┬────────────┘  └────────────┬─────────────┘
              └─────────────┬──────────────┘
                            ▼
┌────────────────────────────────────────────────────────┐
│                   macOS (The World)                    │
│          Your Local System, Apps & Environment         │
└────────────────────────────────────────────────────────┘

```

> **Instinct thinks. OpenAgent acts.**

## Core Features

* **High-Speed Voice Pipeline**: Hold **`F8`** to talk (Push-to-Talk) or use hands-free wake word (*"Wake up Jarvis"*). Features local RMS silence gating, background audio playback, and instant barge-in interruption.
* **Headless Developer Harness**: Ultra-fast Bun + TypeScript runner providing sandboxed `bash` execution, granular file pagination (`read`), atomic `write`, exact diff patching (`edit`), and fast `ripgrep` search.
* **Native macOS Computer-Use**: Inspect application windows (`mac_see`), query semantic UI trees (`mac_ax`), issue PID-targeted clicks and keystrokes, and control authenticated Chrome sessions via CDP without stealing physical focus.
* **Fail-Closed Safety**: Chat-lock verification ensures commands only execute from your authorized Instinct chat. Includes prohibited-target isolation (protects the communication bridge from self-clicking) and append-only deduplication ledgers.
* **Zero-Cloud Intermediary**: All tool execution, screen parsing, and audio handling happen locally on your hardware.

## Quick Start

### Prerequisites

* macOS 14 (Sonoma) or macOS 15 (Sequoia) on Apple Silicon or Intel
* [Homebrew](https://brew.sh/) & [Bun](https://bun.sh/)
* Official **WhatsApp Desktop** installed and logged in

### 1. One-Command Setup & Launch

Clone the repository and run the automated launcher:

```bash
git clone https://github.com/GitCoder052023/OpenAgent.git
cd OpenAgent

chmod +x start.sh
./start.sh

```

`start.sh` automatically checks dependencies, creates the Python virtualenv, installs the native harness, configures `.env`, tests stdio IPC, and spins up the runtime.

```bash
# 1. Install system utilities
brew install python sox ffmpeg ripgrep whisper-cpp
curl -fsSL https://bun.sh/install | bash

# 2. Setup Python environment
python3 -m venv .venv
source .venv/bin/activate
pip install -e '.[dev,voice]' -e ./macos-harness

# 3. Install Bun harness dependencies
cd harness && bun install && cd ..

# 4. Configure environment
cp .env.example .env

# 5. Start OpenAgent
.venv/bin/python3 -m bridge.main run

```


### 2. Grant macOS Permissions

Open **System Settings → Privacy & Security** and verify permissions for your terminal application:

* **Accessibility**: UI inspection and desktop automation
* **Input Monitoring**: Global push-to-talk hotkey (`F8`)
* **Microphone**: Audio recording via SoX
* **Screen Recording**: Window capture (`mac_see`)
* **Automation**: System Events and AppleScript app control

### 3. Connect Instinct (One-Time)

Once OpenAgent is running, initialize Instinct with its capabilities:

1. Open [`docs/JARVIS_INSTRUCTIONS.md`](docs/JARVIS_INSTRUCTIONS.md).
2. Copy the initialization instruction prompt.
3. Paste it directly into your WhatsApp chat with Instinct.

Instinct will recognize the `JARVIS_CALL` protocol and begin executing tasks on your Mac!

## How to Operate

### Push-to-Talk (Default)

1. Run `./start.sh` (or `.venv/bin/python3 -m bridge.main run`).
2. **Hold `F8**` and speak your request.
3. **Release `F8**` to encode and dispatch the request to Instinct.
4. Press `Esc` anytime to cancel or exit.

### Hands-Free Wake-Word Mode

```bash
./start.sh --voice --send-mode audio

```

Say *"Wakeup Jarvis"*, pause, and state your instruction. OpenAgent listens and submits the command automatically once you stop speaking. Say *"Jarvis stand by"* to return to idle.

## Tool Suite

Instinct controls your Mac by wrapping structured JSON calls inside a resilient transport envelope:
`JARVIS_CALL:<base64-encoded-JSON>:END`.

### Developer Harness Tools

| Tool | Description | Key Arguments |
| --- | --- | --- |
| `bash` | Execute shell commands in `zsh` | `command`, `cwd`, `timeout_ms` |
| `read` | Read file contents or list directories with pagination | `path`, `offset`, `limit` |
| `write` | Atomically write or overwrite files | `path`, `content` |
| `edit` | Exact chunk search-and-replace with unified diff output | `path`, `old_string`, `new_string` |
| `grep` | High-speed regex code search via `ripgrep` | `pattern`, `path` |
| `glob` | Find files matching glob patterns | `pattern`, `path` |
| `applescript` | Execute multiline native AppleScript via `osascript` | `script` |
| `system_info` | Inspect local OS version, hardware, and runtime status | *(none)* |

### Native macOS Computer-Use Tools

| Tool | Description | Key Arguments |
| --- | --- | --- |
| `mac_see` | Capture window screenshot and extract interactive UI elements | `app`, `send_image`, `include_summary` |
| `mac_click` | PID-targeted mouse click without stealing focus | `x`, `y`, `app`, `button`, `click_count` |
| `mac_type` | Type text directly into a target application | `text`, `app` |
| `mac_key` | Trigger keyboard shortcuts (e.g., `cmd+s`, `enter`) | `key`, `app` |
| `mac_drag` | Perform drag-and-drop operations | `start_x`, `start_y`, `end_x`, `end_y`, `app` |
| `mac_scroll` | Send directional scroll events | `x`, `y`, `dx`, `dy`, `app` |
| `mac_apps` | List all running applications with process IDs | *(none)* |
| `mac_windows` | List open window titles and bounds for an application | `app` |
| `mac_ax` | Query and interact with macOS Accessibility elements | `action`, `app`, `text` |
| `mac_browser` | Automate authenticated Chrome sessions via CDP | `action`, `url`, `selector` |
| `mac_python` | Run compound, multi-step UI workflows locally in Python | `code` |

> Full schema specifications and example payloads are available in [`docs/JARVIS_INSTRUCTIONS.md`](docs/JARVIS_INSTRUCTIONS.md).

## Configuration

OpenAgent is configured via `.env` in the project root:

| Variable | Default | Description |
| --- | --- | --- |
| `BRIDGE_WHATSAPP_NUMBER` | `+16508702892` | WhatsApp phone number for your Instinct agent |
| `BRIDGE_SAFE_MODE` | `true` | Restrict execution strictly to the verified chat header |
| `BRIDGE_HOTKEY` | `f8` | Push-to-talk hotkey (`f8`, `f6`, `right_shift`, etc.) |
| `BRIDGE_SEND_MODE` | `audio` | `audio` (sends AAC/M4A voice note) or `text` (local Whisper STT) |
| `BRIDGE_SEND_ROUTE` | `picker` | Send route: `picker` (native attachment), `clipboard`, or `auto` |
| `BRIDGE_WHISPER_MODEL` | `models/ggml-base.bin` | Path to offline Whisper model |
| `BRIDGE_VOICE_MODEL` | `models/vosk-model-...` | Path to offline Vosk wake-word model |
| `BRIDGE_VOICE_SILENCE_SECONDS` | `2.0` | Silence delay before auto-submitting voice input |
| `BRIDGE_LOG_FILE` | `~/Library/Logs/OpenAgent/bridge.jsonl` | Diagnostic JSONL event log path |

## Security & Safety Model

Giving an AI assistant access to your Mac requires rigorous guardrails:

* **Fail-Closed Execution**: If chat header verification fails or the target window is ambiguous, OpenAgent halts immediately.
* **Prohibited Target Isolation**: OpenAgent prevents synthetic clicks and keystrokes on the WhatsApp bridge itself, blocking recursive self-activation loops.
* **Persistent Idempotency**: Processed tool signatures are written to an append-only JSONL ledger (`processed.jsonl`) to prevent accidental replays across restarts.
* **Non-Disruptive Interaction**: Window operations and inputs target specific Process IDs (`CGEventPostToPid`) whenever possible, minimizing physical mouse hijacking.

For security reports and guidelines, read [`SECURITY.md`](SECURITY.md).

## Testing & Diagnostics

Run the comprehensive pytest suite:

```bash
.venv/bin/pytest

```

Run the macOS native adapter health check:

```bash
.venv/bin/python3 -c "from bridge.mac_adapter import MacAdapter; print(MacAdapter().doctor())"

```

Stream live runtime logs:

```bash
tail -f ~/Library/Logs/OpenAgent/bridge.jsonl

```

For advanced Accessibility tree inspection and calibration, see [`docs/CALIBRATION.md`](docs/CALIBRATION.md).

## Documentation

- [Setup Prompt & Tool Instructions](docs/JARVIS_INSTRUCTIONS.md) — Initialization block to connect Instinct.
- [Accessibility & Calibration Guide](docs/CALIBRATION.md) — Deep calibration for AX trees, audio routing, and debug states.
- [Security Policy](SECURITY.md) — Security model, threat boundaries, and vulnerability reporting.
- [Contributing Guide](CONTRIBUTING.md) — Development workflow, testing, and tool additions.

---

## Contributing

Contributions, bug reports, and PRs are warmly welcome! Whether you are adding new macOS harness primitives, improving voice latency, or expanding developer tools, check out [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) to get started.

## Credits & Acknowledgments

OpenAgent is built with gratitude on the shoulders of the open-source agent tooling community:
- **[OpenCode](https://github.com/anomalyco/opencode)** — Inspiring open-source agentic coding architectures.
- **[Browser Use](https://github.com/browser-use/browser-use)** & **[macOS Harness](https://github.com/browser-use/macos-harness)** — Pioneering native macOS computer-use foundations.
- **[whisper.cpp](https://github.com/ggerganov/whisper.cpp)** & **[Vosk](https://alphacephei.com/vosk/)** — Lightweight, local, low-latency audio intelligence.

---

<div align="center">
  <sub>OpenAgent is open-source software licensed under the <a href="LICENSE">MIT License</a>.</sub>
</div>