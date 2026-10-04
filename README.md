# OpenAgent

[![macOS](https://img.shields.io/badge/platform-macOS-lightgrey.svg)](https://apple.com)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/)
[![Bun](https://img.shields.io/badge/runtime-bun-black.svg)](https://bun.sh)
[![Tests](https://img.shields.io/badge/tests-98%20passing-brightgreen.svg)]()

A high-speed, local push-to-talk voice and autonomous tool execution bridge connecting macOS to **Jarvis** on WhatsApp Desktop (`+16508702892`).

`OpenAgent` turns WhatsApp Desktop into a full-duplex conversational voice interface and headless Mac execution agent: speak to Jarvis with push-to-talk (F8) or hands-free wake word, receive incoming voice notes in the background, and allow Jarvis to autonomously execute shell commands and file edits on your Mac with sub-second turnaround times.

---

## Key Features

- **Full macOS GUI & Browser Computer Use**:
  Integrated with **macOS Harness** (`macos-harness/`), giving Jarvis eyes and hands to operate macOS applications and real Google Chrome just like you do:
  - `mac_python` / `burst`: Compound Python scripts executing multi-step UI workflows locally in <50ms without WhatsApp latency.
  - `mac_see` (Perception): Background window screenshots via CoreGraphics with virtual pointer overlay; optionally sent straight to WhatsApp as image attachments.
  - `mac_click` / `mac_type` / `mac_key`: Direct background PID input targeting via `CGEventPostToPid` (never steals focus or moves your physical mouse cursor).
  - `mac_ax`: Apple Accessibility tree inspections, button presses, and coordinate queries.
  - `mac_browser`: Real Google Chrome automation via Chrome DevTools Protocol (CDP) in your logged-in profile.
- **Autonomous Headless Code & Shell Harness**:
  Intercepts `JARVIS_CALL` envelopes from WhatsApp messages, executes tools locally via Bun/TypeScript (`harness/`) and Python (`bridge/mac_adapter.py`):
  - `bash`: Full zsh/bash command execution on macOS
  - `read` / `write` / `edit`: Local file manipulation with unified diffs
  - `grep` / `glob`: Fast Ripgrep pattern matching and file discovery
  - `applescript`: Native macOS AppleScript execution

- **Non-Blocking Concurrent Architecture**:
  Voice-note playback runs in a dedicated background worker (`playback_thread`), completely decoupled from the watcher loop. When Jarvis invokes a tool while an incoming voice note is playing, the tool call is detected and executed immediately without waiting for playback to finish.
- **Intelligent Playback Hold & Barge-In**:
  - **Hold**: If the user is speaking, recording, or sending a voice message, incoming voice notes from Jarvis are held and queued in memory; playback only begins after the user's message is delivered.
  - **Barge-In**: Pressing the talk hotkey immediately pauses any active playback and clears echo guards so the user's voice is never dropped as an echo.
- **Dual Voice Input Modes**:
  - **Push-to-Talk**: Hold `F8` (or custom hotkey) to speak, release to send.
  - **Hands-Free Wake-Word Mode**: Say *"Wakeup Jarvis"* to enter hands-free listening (powered by offline Vosk speech recognition); say *"Jarvis stand by"* to sleep.
- **Dual Send Modes**:
  - `audio` (Default): Sends recorded M4A files as WhatsApp attachments using native macOS Accessibility UI automation.
  - `text`: Transcribes speech locally on-device using `whisper.cpp` and pastes text into chat.
- **Background Privacy & Fail-Closed Safety**:
  WhatsApp Desktop remains completely hidden and backgrounded while running. Dynamic chat header verification prevents cross-chat message leaks, and a persistent deduplication ledger (`ProcessedLedger`) guarantees messages and tool calls are never replayed across restarts.

---

## Project Structure

```text
OpenAgent/
├── bridge/                         # Core Python bridge package
│   ├── main.py                     # Entry point, CLI flags, hotkey loop & orchestration
│   ├── replies.py                  # Message watcher, non-blocking playback, tool dispatch
│   ├── desktop.py                  # macOS Accessibility (AX) & AppleScript automation
│   ├── dispatcher.py               # JARVIS_CALL parser, validator & envelope formatter
│   ├── harness.py                  # Python interface to the Bun/TS headless harness
│   ├── ax.py                       # macOS Accessibility API wrappers & header checks
│   ├── audio.py                    # SoX recording, silence gating & audio conversion
│   ├── voice.py                    # Hands-free Vosk wake word & silence detector
│   ├── config.py                   # Environment configuration loader (.env)
│   └── diagnostics.py              # Structured JSON event logging
├── harness/                        # Headless TypeScript execution harness
│   ├── harness-bridge.ts           # Bun execution bridge exposing local tools
│   ├── package.json                # Harness dependencies (Effect, TypeScript, etc.)
│   ├── bunfig.toml                 # Bun configuration
│   └── packages/                   # Core harness packages
├── scripts/                        # Automation & helper scripts
│   ├── send.scpt                   # AppleScript: pastes and sends message to WhatsApp
│   ├── commit.scpt                 # AppleScript: presses Enter in WhatsApp
│   ├── attach.scpt                 # AppleScript: drives file chooser dialog
│   ├── commit-audio.scpt           # AppleScript: confirms audio preview send
│   └── download-model.sh           # Whisper GGML model downloader
├── models/                         # Local ML models
│   ├── ggml-base.bin               # Multilingual whisper.cpp model
│   └── vosk-model-small-en-us-0.15 # Offline wake word & silence detection model
├── tests/                          # Pytest test suite (98 tests)
│   ├── test_replies_tools.py       # Watcher, tool dispatch, playback hold & concurrency
│   ├── test_dispatcher.py          # JARVIS_CALL base64 parsing & validation
│   ├── test_harness.py             # Local tool execution tests
│   ├── test_safety.py              # Header lock, safe mode & fail-closed tests
│   ├── test_voice_capture.py       # Audio recording & format validation
│   ├── test_voice_wake_drop.py     # Wake word and sleep state machine tests
│   └── test_diagnostics_gate.py    # Silence gating and diagnostics
├── docs/                           # Documentation
│   ├── setup.md                    # Initial calibration & environment setup
│   ├── architecture.md             # Security model & fail-closed design
│   ├── limitations.md              # Known limitations & constraints
│   ├── JARVIS_INSTRUCTIONS.md      # Instructions & prompt for Jarvis
│   └── voice-routing-design.md     # Audio routing & echo prevention design
├── start.sh                        # All-in-one launcher with environment preflights
├── pyproject.toml                  # Python package definition & dependencies
└── README.md                       # This file
```

---

## Requirements

- **Operating System**: macOS (Apple Silicon or Intel, tested on macOS 14/15/Sonoma/Sequoia).
- **WhatsApp Desktop**: Native macOS app running and signed into the destination chat (`+16508702892`).
- **Python**: 3.11+
- **Bun**: Modern JavaScript/TypeScript runtime ([bun.sh](https://bun.sh))
- **Homebrew Packages**: `sox`, `whisper-cpp`, `ffmpeg`, `ripgrep`
- **macOS Permissions**:
  - *Accessibility* (System Settings -> Privacy & Security -> Accessibility)
  - *Microphone* (System Settings -> Privacy & Security -> Microphone)
  - *Input Monitoring* (System Settings -> Privacy & Security -> Input Monitoring)

---

## Quick Start

### 1. One-Command Automated Launch

The easiest way to start is using the launcher script, which runs environment preflights, verifies Bun, checks Python virtualenv, and starts the bridge:

```bash
./start.sh
```

To run with specific flags (e.g. Whisper text mode):
```bash
./start.sh --send-mode text
```

### 2. Manual Installation & Setup

1. **Install system dependencies**:
   ```bash
   brew install python sox whisper-cpp ffmpeg ripgrep
   curl -fsSL https://bun.sh/install | bash
   ```

2. **Set up Python virtual environment**:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -e '.[dev,voice]'
   ```

3. **Install harness dependencies**:
   ```bash
   cd harness && bun install && cd ..
   ```

4. **Download models**:
   ```bash
   bash scripts/download-model.sh base
   ```
   *(For hands-free voice mode, download the small Vosk model into `models/vosk-model-small-en-us-0.15`)*

5. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your chat calibration (see docs/setup.md)
   ```

6. **Inspect WhatsApp Accessibility layout**:
   ```bash
   OpenAgent inspect > ax-tree.json
   ```

7. **Run the bridge**:
   ```bash
   OpenAgent run
   ```

---

## Operating Modes

### 1. Push-to-Talk (Default)
Hold **`F8`** (or configured hotkey) to speak. When you release the key:
- In `audio` mode (default), the recorded audio is converted to M4A and sent as a document attachment.
- In `text` mode (`--send-mode text`), local `whisper-cli` transcribes your speech and pastes it into WhatsApp.
- Press `Esc` anytime to quit.

### 2. Hands-Free Always-Listening Voice Mode (`--voice`)
```bash
OpenAgent run --voice --send-mode audio
```
- The microphone stays open in memory.
- Say **"Wakeup Jarvis"** as a separate phrase to activate listening.
- Speech is recorded and automatically sent when you stop speaking (after 2 seconds of quiet).
- Say **"Jarvis stand by"** followed by **"confirm stand by Jarvis"** to return to sleep mode.

### 3. Headless Tool Execution (Autonomous Mac Control)
When Jarvis sends a command inside a `JARVIS_CALL` envelope:
```text
JARVIS_CALL:eyJ0b29sIjogImJhc2giLCAiYXJncyI6IHsiY29tbWFuZCI6ICJ1bmFtZSAtYSJ9fQ==:END
```
The bridge intercepts the message, dispatches it to `harness/harness-bridge.ts`, executes the command, and automatically posts the result back to WhatsApp:
```text
[Jarvis Tool Response: bash | status: ok]
```
Darwin Mac.local 24.x.x arm64
```
```
See [docs/JARVIS_INSTRUCTIONS.md](docs/JARVIS_INSTRUCTIONS.md) for the complete prompt and protocol instructions to send to Jarvis.

---

## Safety & Security

- **Strict Chat Lock**: By default, `BRIDGE_SAFE_MODE=true` enforces that every action verifies the active WhatsApp chat header matches the calibrated target number before sending or clicking.
- **Append-Only Ledger**: The bridge maintains an on-disk ledger (`~/.cache/OpenAgent/processed_texts.json`) of processed message signatures. Old chat history and previously executed tool envelopes will **never** re-execute across restarts.
- **Background Operation**: WhatsApp Desktop remains completely hidden from your screen, preventing accidental UI clicks or screen clutter.

---

## Running Tests

Run the full pytest suite:

```bash
.venv/bin/python3 -m pytest
```

The test suite covers:
- Tool call parsing, validation, and execution
- Non-blocking concurrent voice playback & tool response
- Playback hold during user recording and barge-in
- Audio gate, silence thresholding, and format conversion
- Safety checks, safe-mode lock verification, and error handling

---

## Documentation

- [Setup & Calibration Guide](docs/setup.md)
- [Architecture & Safety Guarantees](docs/architecture.md)
- [Operational Instructions for Jarvis](docs/JARVIS_INSTRUCTIONS.md)
- [Voice Routing & Audio Design](docs/voice-routing-design.md)
- [Limitations & Caveats](docs/limitations.md)
