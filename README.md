<img src="https://raw.githubusercontent.com/browser-use/macos-harness/main/static/banner-ink.svg" alt="OpenAgent" width="100%" />

# OpenAgent

> **The local Mac computer-use body specifically built for Instinct.**

[![macOS](https://img.shields.io/badge/platform-macOS%20Darwin-lightgrey.svg)](https://apple.com)
[![Python](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/)
[![Bun](https://img.shields.io/badge/runtime-bun-black.svg)](https://bun.sh)
[![Tests](https://img.shields.io/badge/tests-125%20passing-brightgreen.svg)]()
[![Status](https://img.shields.io/badge/status-active%20beta-orange.svg)]()

## What is OpenAgent?

**OpenAgent is an open-source, local execution and interaction runtime for macOS specifically engineered for [Instinct](https://instinct.com/).**

Instinct is a free, invite-only personal AI assistant and agent created by Noah Shinn and the team at Spear Street Technology, Inc. in San Francisco. Instinct is designed to manage daily life, travel, scheduling, and personal administration, communicating with users through high-touch conversational interfaces—including WhatsApp, text messages, iMessage, SMS, and phone calls.

However, remote conversational agents face a universal limitation: **they are trapped in messaging threads.** When you ask a traditional assistant to inspect a code repository, organize your downloads folder, check an internal web dashboard, or control a desktop app, it can only give you text instructions. It has no eyes to see your screen and no hands to operate your keyboard and mouse.

**OpenAgent solves this by giving Instinct a native macOS body.**

OpenAgent runs locally on your Mac, sitting between your active Instinct conversation and your operating system. It quietly intercepts structured tool calls emitted by Instinct, translates them into real macOS actions—shell commands, file edits, accessibility clicks, screen perception, and browser automation—and feeds the results back into the conversation in real time.

```text
┌─────────────────────────────────┐
│        Instinct (The Mind)      │  Conversational intelligence, planning, reasoning,
│                                 │  and user interaction across chat/voice.
└────────────────┬────────────────┘
                 │ Emits structured tool calls (`JARVIS_CALL`)
                 ▼
┌─────────────────────────────────┐
│       OpenAgent (The Body)      │  Local macOS runtime: message transport, execution
│                                 │  dispatch, voice orchestration, and safety gating.
└────────────────┬────────────────┘
                 │ Natively operates
                 ▼
┌─────────────────────────────────┐
│        macOS (The World)        │  Terminal, filesystems, native applications,
│                                 │  window manager, and Google Chrome.
└─────────────────────────────────┘
```

## What Powers OpenAgent Gives to Instinct

Without OpenAgent, Instinct is an intelligent conversationalist with zero local machine access. With OpenAgent installed, Instinct gains full computer-use agency over your Mac.

| Capability | Instinct Alone | Instinct + OpenAgent |
| :--- | :--- | :--- |
| **Shell & Terminal** | Can write code snippets in chat for you to copy-paste. | **Executes shell commands directly** in macOS `zsh` with timeouts, directory context, and exit code capture. |
| **Filesystem Access** | Cannot see or modify any local files. | **Reads, writes, and edits local files**; performs search-and-replace chunk edits with verified unified diffs. |
| **Code & File Search** | Blind to your local repositories. | **Blazing-fast pattern searches** via `ripgrep` (`grep`) and file discovery (`glob`). |
| **Visual Perception** | Cannot see your desktop. | **Takes background window screenshots** (`mac_see`), identifies visible UI elements, and sends screenshots back to WhatsApp. |
| **Mouse & Keyboard Control** | Cannot interact with desktop software. | **Clicks, moves, types, drags, and scrolls** targeting specific application PIDs (`CGEventPostToPid`) without stealing your focus or moving your mouse. |
| **macOS Accessibility** | Cannot inspect native Mac UI. | **Queries and drives native AX element trees** (`mac_ax`) across Finder, Notes, System Settings, and third-party apps. |
| **Real Browser Automation** | Can only browse via public web APIs or serverless scrapers. | **Drives your real, logged-in Google Chrome** via Chrome DevTools Protocol (CDP): navigates, reads DOM, inspects tabs, and evaluates scripts. |
| **AppleScript Integration** | Cannot control Mac system events. | **Runs native multiline AppleScript** to control Spotify, Calendar, Reminders, Finder, and system dialogs. |
| **Sub-Second Multi-Step UI** | Each step requires a 2-second round trip across WhatsApp. | **Executes compound Python bursts** (`mac_python`): multi-step UI sequences run locally in <50ms. |
| **Voice Interaction** | Relies on mobile voice notes or phone calls. | **Full-duplex Mac voice companion**: push-to-talk hotkey or hands-free wake word, with instant barge-in interruption. |

## The JARVIS Philosophy: From Chatbot to Computer Companion

OpenAgent was built to bring the **JARVIS experience** to life on macOS. 

The goal is not to build a chatbot that occasionally runs a script. The goal is to make your computer feel like it has an intelligent assistant living alongside it—listening when addressed, aware of what is happening on screen, and capable of taking real action on your behalf.

### The Shift in Workflow

Traditional assistants operate in a detached, advisory loop:

```text
User asks question ────► Assistant writes instructions ────► User does the manual work
```

Instinct powered by OpenAgent creates an active execution loop:

```text
User states intent (Voice/Text)
       │
       ▼
Instinct reasons & issues computer actions
       │
       ▼
OpenAgent executes on macOS (Terminal, GUI, Files, Browser)
       │
       ▼
Instinct reviews execution results
       │
       ▼
User receives the outcome and continues the dialogue
```

The core rhythm is: **conversation → intent → computer action → result → conversation**.

## Real-World Use Cases

Here are practical workflows unlocked when Instinct is connected to OpenAgent:

### 1. Hands-Free Software Engineering
* *"Instinct, pull the latest changes on `main`, run the test suite, and if anything fails, inspect the stack trace and fix it."*
  * Instinct invokes `bash` to run `git pull` and `pytest`.
  * If a test fails, Instinct invokes `grep` to locate the offending file, `read` to inspect it, and `edit` to apply a patch with a unified diff.
  * Instinct re-runs the tests and reports back via voice: *"Fixed a KeyError in dispatcher.py. All 125 tests are passing now."*

### 2. Desktop Application & Media Control
* *"Instinct, play my Discover Weekly on Spotify, close all background Finder windows, and check if Xcode is still compiling."*
  * Instinct dispatches `applescript` to interact with Spotify's player API.
  * Instinct dispatches `mac_apps` and `mac_windows` to inspect running processes.
  * Instinct reports: *"Spotify is playing, Finder is cleaned up, and Xcode finished building 2 minutes ago."*

### 3. Logged-In Browser Tasks (via Chrome CDP)
* *"Instinct, open our internal billing dashboard in Chrome, check today's total active users, and tell me if there are any alerts."*
  * Instinct invokes `mac_browser` to connect to your existing, logged-in Chrome session.
  * It navigates to the URL, queries the DOM via `eval`, extracts the data, and returns the numbers into your chat.
  * No credentials or sessions need to leave your computer.

### 4. Visual Desktop Troubleshooting & UI Action
* *"Instinct, look at this error dialog on my screen and dismiss it if it's safe."*
  * Instinct invokes `mac_see` to capture the frontmost application window.
  * It inspects the visible buttons, finds the "Dismiss" button coordinates, calls `mac_click` to click it, and optionally sends the captured screenshot back to your chat.
  * Your physical mouse cursor never moves, and your active window never loses focus.

### 5. Ambient Voice-First Computing
* While working in a full-screen app or cooking across the room:
  * Hold **F8** (or say *"Wakeup Jarvis"*) and speak naturally: *"Instinct, find all PDF files downloaded in the last 24 hours and move them into the Receipts folder."*
  * Release **F8**.
  * Instinct runs `glob` and `bash` to organize the files, then sends a voice note confirming the action.
  * If you start speaking while Instinct is replying, OpenAgent's barge-in engine immediately pauses playback so you are never interrupted.

## How It Works: The Architecture & Workflow

OpenAgent creates an ultra-low-latency bridge between WhatsApp Desktop (running in the background) and macOS system APIs.

### Architecture Overview

```text
                               ┌───────────────────────────┐
                               │           User            │
                               └─────────────┬─────────────┘
                                             │
                        ┌────────────────────┴────────────────────┐
                        │ Voice (Push-to-Talk / Wake Word)        │ Text (WhatsApp)
                        ▼                                         ▼
            ┌─────────────────────────────────────────────────────────────┐
            │                      Instinct (Remote)                      │
            │               Reasoning, Planning & Dialogue                │
            └──────────────────────────────┬──────────────────────────────┘
                                           │ Encrypted WhatsApp Message
                                           ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                       OpenAgent                                        │
│                                                                                        │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │                         Python Bridge (`bridge/`)                              │   │
│   │                                                                                │   │
│   │   • Voice Engine (SoX capture, ffmpeg AAC, whisper.cpp STT, Vosk wake-word)    │   │
│   │   • AX Message Watcher & Background Playback Worker                            │   │
│   │   • `JARVIS_CALL` Base64 Decoder & Multi-Schema Parser                         │   │
│   │   • Chat Header Verification & Persistent Deduplication Ledger                 │   │
│   │   • Response Formatter with WhatsApp Message Truncation Protection             │   │
│   └───────────────────────┬────────────────────────────────┬───────────────────────┘   │
│                           │                                │                           │
│                           ▼ (JSON-RPC via stdio)           ▼ (In-process Python)       │
│   ┌──────────────────────────────────┐   ┌─────────────────────────────────────────┐   │
│   │   Headless Harness (`harness/`)  │   │   macOS Harness (`macos-harness/`)      │   │
│   │   (Bun / TypeScript Execution)   │   │   (Native ApplicationServices / CDP)    │   │
│   │                                  │   │                                         │   │
│   │   • bash (zsh commands)          │   │   • mac_see (window capture & vision)   │   │
│   │   • read / write (file I/O)      │   │   • mac_click / mac_move (PID input)    │   │
│   │   • edit (chunk search & diff)   │   │   • mac_type / mac_key (keystrokes)     │   │
│   │   • grep / glob (ripgrep)        │   │   • mac_ax (Accessibility tree actions) │   │
│   │   • applescript (osascript)      │   │   • mac_browser (Chrome DevTools CDP)   │   │
│   │   • system_info                  │   │   • mac_python (compound 50ms bursts)   │   │
│   └───────────────────┬──────────────┘   └────────────────────┬────────────────────┘   │
└───────────────────────┼───────────────────────────────────────┼────────────────────────┘
                        │                                       │
                        ▼                                       ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   macOS Environment                                    │
│                                                                                        │
│       Zsh Shell  •  Local Filesystem  •  Desktop Applications  •  Google Chrome        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### The 10-Step Execution Lifecycle

1. **User Speaks or Messages**: You hold `F8` to talk or type a prompt to Instinct over WhatsApp.
2. **Instinct Reasons**: Instinct decides that completing your request requires interacting with your Mac.
3. **Envelope Generation**: Instinct wraps a structured tool invocation inside a resilient `JARVIS_CALL` envelope:
   ```text
   JARVIS_CALL:eyJ0b29sIjogImJhc2giLCAiYXJncyI6IHsiY29tbWFuZCI6ICJ1bmFtZSAtYSJ9fQ==:END
   ```
4. **AX Message Interception**: OpenAgent's background watcher (`bridge/replies.py`) reads the incoming message directly from WhatsApp Desktop's accessibility tree (`AXUIElement`). *WhatsApp remains completely hidden in the background.*
5. **Safety Check & Deduplication**:
   * OpenAgent verifies that the active chat header strictly matches Instinct's calibrated phone number (`BRIDGE_SAFE_MODE=true`).
   * The message signature is checked against an append-only on-disk ledger (`~/Library/Logs/OpenAgent/processed.jsonl`) to ensure no message or tool call is ever executed twice.
6. **Transport Decoding**: `bridge/dispatcher.py` strips zero-width characters, unmarshals the base64 payload, and normalizes the tool schema (supporting OpenAI, Anthropic, or standard JSON schemas).
7. **Harness Routing & Execution**:
   * Developer tools (`bash`, `read`, `write`, `edit`, `grep`, `glob`, `applescript`) route over stdio IPC to the Bun/TypeScript harness.
   * Native Mac tools (`mac_see`, `mac_click`, `mac_type`, `mac_ax`, `mac_browser`, `mac_python`) execute via `macos-harness` using direct macOS `ApplicationServices` APIs.
8. **Result Capture & Formatting**: The tool output, exit code, execution duration, and diffs are captured and formatted into clean Markdown, automatically truncated if necessary to respect messaging bubble limits.
9. **Delivery Back to WhatsApp**: OpenAgent uses high-speed pasteboard injection and AppleScript to submit the result into the chat in milliseconds. Any generated screenshots (`mac_see`) are dispatched as image attachments.
10. **Conversational Continuation**: Instinct ingests the result and responds to you with the completed task or next steps.

## Core Features of OpenAgent

### 1. Conversational Bridge (`bridge/`)
* **Zero Focus Stealing**: WhatsApp Desktop runs minimized/hidden in the background (`open -g -j`). OpenAgent interacts with it purely through macOS Accessibility and AppleScript.
* **Resilient `JARVIS_CALL` Transport**: Messaging apps automatically reformat text (converting backticks into code spans and stripping characters). OpenAgent uses standard base64 envelopes with regex fallbacks to guarantee 100% data fidelity.
* **Persistent Deduplication Ledger**: Tool calls and voice note IDs are recorded in an append-only JSONL ledger. Restarting OpenAgent will never replay old messages or re-run historical commands.
* **Chat Target Lock**: Safe mode refuses to operate if the active WhatsApp chat differs from the configured destination number.

### 2. High-Speed Voice Pipeline (`bridge/audio.py`, `bridge/voice.py`)
* **Push-to-Talk (PTT)**: Hold a single hotkey (default: `F8`, configurable to `F6`, `Right Shift`, etc.) to talk; release to send. Press `Esc` to cancel.
* **Dual Send Modes**:
  * `audio` (Default): Converts microphone audio into high-efficiency AAC/M4A via `ffmpeg` and sends it as an audio attachment.
  * `text` (`--send-mode text`): Transcribes your speech on-device with zero cloud latency using `whisper.cpp` (`whisper-cli`) and pastes text into chat.
* **Hands-Free Wake-Word Mode (`--voice`)**: Powered by an offline Vosk speech recognition model. Say *"Wakeup Jarvis"* to start listening, and *"Jarvis stand by"* followed by *"confirm"* to return to sleep.
* **Echo Guards & Energy Gating**: RMS silence detection (`gate_pcm`) rejects empty recordings, accidental taps, and background room noise.
* **Asynchronous Playback with Barge-In**:
  * Voice replies from Instinct play in a dedicated background worker (`playback_thread`), so incoming tool calls are never blocked by audio playback.
  * **Playback Hold**: If you start recording while Instinct is sending a voice note, Instinct's note is held in memory until your message finishes sending.
  * **Barge-In**: Pressing the hotkey immediately stops any active voice playback, clearing echo guards so your speech is never lost.

### 3. Headless Developer Harness (`harness/`)
Running as a persistent Bun child process communicating via stdio JSON-RPC:
* `bash`: Runs zsh commands with custom timeouts, working directory options, and 512KB output truncation protection.
* `read`: Reads files with line pagination and provides fuzzy path suggestions if a typo occurs.
* `write`: Writes files atomically to disk.
* `edit`: Searches for an exact block of text and replaces it, returning a standard unified diff.
* `grep`: Searches code patterns across your Mac with `ripgrep` (`rg`).
* `glob`: Discovers files matching glob patterns safely without shell expansion vulnerabilities.
* `applescript`: Executes native multiline AppleScript directly via `osascript`.
* `system_info`: Inspects macOS platform, architecture, Bun version, current user, and environment variables.

### 4. Native macOS Computer-Use Engine (`macos-harness/`)
A dedicated Python package built directly on macOS public `ApplicationServices` APIs (no third-party cloud runtimes):
* **`mac_see` (Visual Perception)**: Captures bounded window screenshots via CoreGraphics and `screencapture`. Extracts visible interactive controls (`AXButton`, `AXTextField`, etc.) with screen coordinates and can dispatch the image directly to WhatsApp.
* **`mac_click` / `mac_move` / `mac_type` / `mac_key` / `mac_drag` / `mac_scroll`**: Dispatches mouse clicks, pointer movements, typing, shortcuts, drags, and scrolls directly to target process IDs (`CGEventPostToPid`). **Never steals window focus and never moves your physical mouse cursor.**
* **`LivePointerOverlay`**: Displays a non-intrusive on-screen visual pointer showing where the agent is looking or clicking.
* **`mac_ax` (Accessibility Tree)**: Inspects, queries, and invokes semantic actions on native macOS Accessibility elements.
* **`mac_browser` (Chrome DevTools Protocol)**: Direct control of Google Chrome. Connects to your running browser to navigate pages, inspect tabs, and evaluate JavaScript in your logged-in session.
* **`mac_python` (Compound Burst Execution)**: Allows Instinct to execute a compound Python script in a sandboxed runtime preloaded with `mac`, `browser`, `Path`, and `subprocess`. Executes multi-step UI workflows locally in <50ms without WhatsApp latency.
* **Safety Target Isolation**: Hardcoded guards (`PROHIBITED_TARGETS`) prevent Instinct from sending synthetic clicks or keystrokes into WhatsApp Desktop, preserving the bridge's communication channel.

## Tool Protocol & Reference

Instinct communicates with OpenAgent using JSON tool calls wrapped in the `JARVIS_CALL` envelope:

```text
JARVIS_CALL:<base64-encoded JSON>:END
```

### Supported Tool Primitives

#### 1. System & Developer Tools (`harness/`)

```json
// Execute shell command
{"tool": "bash", "args": {"command": "git status", "cwd": "/Users/you/project", "timeout_ms": 30000}}

// Read a file or list a directory
{"tool": "read", "args": {"path": "src/main.py", "offset": 1, "limit": 100}}

// Write file atomically
{"tool": "write", "args": {"path": "config.json", "content": "{\n  \"active\": true\n}\n"}}

// Exact chunk replace with diff output
{"tool": "edit", "args": {"path": "main.py", "old_string": "debug = False", "new_string": "debug = True"}}

// Fast ripgrep search
{"tool": "grep", "args": {"pattern": "def handle_request", "path": "src/"}}

// Glob file matching
{"tool": "glob", "args": {"pattern": "**/*.py", "path": "src/"}}

// Native AppleScript execution
{"tool": "applescript", "args": {"script": "tell application \"Spotify\" to play"}}

// System environment info
{"tool": "system_info", "args": {}}
```

#### 2. Native macOS Computer-Use Tools (`macos-harness/`)

```json
// Compound Python burst (executes multi-step UI locally in <50ms)
{"tool": "mac_python", "args": {"code": "mac.click(400, 300, app='Notes')\nmac.type('Meeting Notes', app='Notes')\nmac.key('enter', app='Notes')"}}

// Window screenshot & interactive control extraction
{"tool": "mac_see", "args": {"app": "Finder", "send_image": true, "include_summary": true}}

// Targeted background click
{"tool": "mac_click", "args": {"x": 640, "y": 480, "app": "Notes", "button": "left", "click_count": 1}}

// Move virtual pointer overlay
{"tool": "mac_move", "args": {"x": 640, "y": 480, "app": "Notes"}}

// Direct keystrokes to PID
{"tool": "mac_type", "args": {"text": "Hello Instinct!", "app": "Notes"}}

// Send keyboard shortcut
{"tool": "mac_key", "args": {"key": "cmd+s", "app": "Notes"}}

// Drag operation
{"tool": "mac_drag", "args": {"start_x": 100, "start_y": 100, "end_x": 300, "end_y": 100, "app": "Finder"}}

// Scroll wheel
{"tool": "mac_scroll", "args": {"x": 500, "y": 500, "dx": 0, "dy": -5, "app": "Safari"}}

// List running applications
{"tool": "mac_apps", "args": {}}

// List windows and coordinates
{"tool": "mac_windows", "args": {"app": "Google Chrome"}}

// macOS Accessibility inspection & action
{"tool": "mac_ax", "args": {"action": "query", "app": "Finder", "text": "Downloads"}}

// Google Chrome CDP automation
{"tool": "mac_browser", "args": {"action": "navigate", "url": "https://github.com"}}
```

## Requirements

* **Operating System**: macOS 14 (Sonoma) or macOS 15 (Sequoia) running on Apple Silicon (M1/M2/M3/M4) or Intel.
* **WhatsApp Desktop**: The official macOS desktop app, open and logged in to your conversation with Instinct (`+16508702892` or your registered number).
* **Software Runtimes**:
  * Python 3.11+
  * [Bun](https://bun.sh) (modern high-speed JS/TS runtime)
* **System CLI Utilities** (installable via Homebrew):
  * `sox` (microphone recording)
  * `ffmpeg` (audio encoding to AAC/M4A)
  * `ripgrep` (file searching)
  * `whisper-cpp` (optional, for local speech-to-text)
* **macOS Permissions** (`System Settings → Privacy & Security`):
  * **Accessibility**: Required to inspect WhatsApp UI trees, capture hotkeys, and interact with applications.
  * **Input Monitoring**: Required to detect push-to-talk hotkey presses globally.
  * **Microphone**: Required to capture audio.
  * **Screen Recording**: Required for `mac_see` background window capture.

## Installation & Setup

### Option A: One-Command Automated Launch (Recommended)

The included `start.sh` script automates dependency verification, environment creation, harness testing, permission checks, and launches OpenAgent:

```bash
chmod +x start.sh
./start.sh
```

To run with specific flags (e.g. Whisper on-device text mode):
```bash
./start.sh --send-mode text
```

> **Next step:** Complete the [One-Time Setup](#one-time-setup-turn-instinct-into-your-jarvis) by copying [`docs/JARVIS_INSTRUCTIONS.md`](docs/JARVIS_INSTRUCTIONS.md) into your chat with Instinct on WhatsApp to immediately activate its local Mac tools.

---

### Option B: Step-by-Step Manual Setup

#### 1. Install System Dependencies via Homebrew
```bash
brew install python sox ffmpeg ripgrep whisper-cpp
curl -fsSL https://bun.sh/install | bash
```

#### 2. Clone Repository & Set Up Python Virtual Environment
```bash
git clone https://github.com/GitCoder052023/OpenAgent.git
cd OpenAgent

python3 -m venv .venv
source .venv/bin/activate
pip install -e '.[dev,voice]' -e ./macos-harness
```
> [!NOTE]
> Installing `-e ./macos-harness` installs OpenAgent's native macOS computer-use engine in editable mode alongside the bridge.

#### 3. Install Headless Harness Dependencies
```bash
cd harness
bun install
cd ..
```

#### 4. Configure Environment Variables
```bash
cp .env.example .env
```
Edit `.env` to configure your settings (see [Configuration Reference](#configuration-reference)).

#### 5. Download Voice Models with `scripts/download-model.sh`
To enable local transcription with Whisper, use the included helper script `scripts/download-model.sh`:

```bash
# Download the recommended multilingual Whisper model into models/:
bash scripts/download-model.sh base

# Other supported model targets: small, base.en, small.en
# e.g.: bash scripts/download-model.sh base.en (English-only)
```
This script fetches the official GGML model from the [whisper.cpp models repository](https://github.com/ggml-org/whisper.cpp/tree/master/models) directly into `models/`.

If you also plan to use hands-free Vosk wake-phrase mode:
```bash
mkdir -p models
curl -L https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip -o models/vosk.zip
unzip models/vosk.zip -d models/ && rm models/vosk.zip
```

#### 6. Inspect WhatsApp Accessibility Layout
Before starting, verify that macOS Accessibility can read WhatsApp Desktop:
```bash
.venv/bin/python3 -m bridge.main inspect > ax-tree.json
```
If this succeeds, your Accessibility permissions are correctly configured.

#### 7. Run OpenAgent
```bash
# Push-to-Talk Mode (Default: Hold F8 to speak):
.venv/bin/python3 -m bridge.main run

# Hands-Free Wake-Word Mode (Say "Wakeup Jarvis"):
.venv/bin/python3 -m bridge.main run --voice --send-mode audio
```

### Calibration, Verification & First Test Guide

To ensure fail-closed security and reliable UI automation, follow these essential steps to calibrate OpenAgent for your specific WhatsApp Desktop installation:

#### 1. Chat Verification & Lock Assertions
* Open the **official WhatsApp Desktop** app and navigate to your unsaved-number Instinct chat.
* Verify that **`+16508702892`** appears explicitly in the selected chat header. (Note: the iMessage phone line format differs).
* **Security Rule:** If only a saved contact name appears without the raw phone number, **stop rather than weakening the lock**. Never relax or disable the phone number check just to make a test pass.
* Keep WhatsApp visible and foregrounded during initial calibration and testing.

#### 2. Model Selection & Accents (Use `scripts/download-model.sh`)
* **Use the provided download script:** Run `bash scripts/download-model.sh base` to fetch the model. Its upstream documentation is at [whisper.cpp models](https://github.com/ggml-org/whisper.cpp/tree/master/models).
* `base` downloads the multilingual model (recommended); `base.en` is English-only; `small` / `small.en` offer higher accuracy.
* Set `BRIDGE_WHISPER_MODEL=models/ggml-base.bin` and `BRIDGE_LANGUAGE=auto` for multilingual accents or Hinglish. Verify transcription accuracy with your natural speaking voice using `whisper-cli --help`.

#### 3. macOS Permissions & Audio Routing
* In **System Settings → Privacy & Security**, grant Terminal / Python permissions for:
  * **Microphone**
  * **Accessibility**
  * **Input Monitoring** (for global `F8` hotkey detection)
  * **Automation** (for WhatsApp and System Events)
* *Tip:* Restart your terminal application if permissions do not stick.
* Select your desired Bluetooth speaker or headphones as the **macOS System Output** in Control Center, and verify standard WhatsApp voice playback manually first.

#### 4. AX Tree Calibration & Privacy Warning
* Generate an Accessibility snapshot:
  ```bash
  .venv/bin/python3 -m bridge.main inspect > ax-tree.json
  ```
  > [!CAUTION]
  > **Privacy Notice**: `ax-tree.json` dumps the raw UI tree of WhatsApp and contains private message text. **Keep it local, never commit or share it, and delete the file once calibration is complete.**
* In `ax-tree.json`, locate the selected chat header's exact-number `AXStaticText` or `AXButton` node and set `BRIDGE_HEADER_PATH` in `.env` to its exact `path`.
* **Verify the Lock:** Switch to a different chat and run the inspect command again; confirm that OpenAgent fails the number verification check.
* *Keyboard Tip:* On Apple keyboards with media keys, `F8` may require pressing `Fn + F8`. You can customize the hotkey via `BRIDGE_HOTKEY` in `.env` (e.g. `f6` or `right_shift`).

#### 5. Calibrating the Opt-In Voice-Note Watcher
* In that exact chat, arrange harmless incoming voice and text test messages plus an outgoing voice message.
* In `ax-tree.json`:
  * Identify the message list container (`AXList`, `AXScrollArea`, or `AXGroup`) and set `BRIDGE_MESSAGE_LIST_PATH`.
  * Find an **incoming direction marker in non-body AX title/description** that is absent on outbound bubbles, and set `BRIDGE_INCOMING_MARKER`.
  * Find the exact Play and Pause labels for incoming voice notes and set `BRIDGE_VOICE_PLAY_MARKER` and `BRIDGE_VOICE_PAUSE_MARKER` (must be distinct and identify one control per voice group).
* *Note:* If your WhatsApp build lacks reliable direction or play/pause labels, leave them empty and use manual playback.
* The watcher baselines all visible messages on startup so historical messages are never replayed. Audio plays natively through WhatsApp to macOS system output; the bridge does not download media or TTS text. (`OpenAgent speak --text 'Speaker check'` tests manual TTS only, not incoming note playback).

#### 6. Audio-File Send Routes (Clipboard vs. Picker)
When sending recorded M4A audio files, OpenAgent supports two routes via `BRIDGE_SEND_ROUTE`:
* **Picker Route (`BRIDGE_SEND_ROUTE=picker`, Default)**: Sends through WhatsApp's native *Attach > Document* file picker dialog. Calibrate `BRIDGE_ATTACH_LABEL`, `BRIDGE_DOCUMENT_LABEL`, and `BRIDGE_ATTACHMENT_SEND_LABEL` in `.env`.
* **Clipboard Route (`BRIDGE_SEND_ROUTE=clipboard` or `auto`)**: Stages the M4A on the macOS clipboard (`NSPasteboard` file URL and `NSFilenamesPboardType`), focuses the composer, and pastes via `Cmd+V`.
  * After each paste attempt, OpenAgent monitors the outcome to avoid duplicate sends:
    * `preview`: File attached successfully; sends directly from preview.
    * `polluted`: Paste landed as raw text in the composer; OpenAgent selects all, clears the draft, and falls back to the picker.
    * `empty`: WhatsApp ignored the paste; retries once via Edit > Paste menu, then falls back to the picker.
    * `ambiguous`: Unknown paste outcome; halts immediately to avoid sending duplicate messages.
  * Set `BRIDGE_SEND_ROUTE=auto` in `.env` to attempt clipboard paste first with automatic picker fallback.

#### 7. Phase 2: Hands-Free Voice Mode Trial
* Install voice dependencies: `pip install -e '.[voice]' -e ./macos-harness`.
* Download and extract a Vosk model to `models/vosk-model-small-en-us-0.15` and set `BRIDGE_VOICE_MODEL`.
* Run `OpenAgent run --voice --send-mode audio` with a headset in a quiet room.
* **Test Sequence:**
  1. Say *"Wakeup Jarvis"* alone and pause.
  2. Dictate a short test message and pause for 2 seconds.
  3. Say *"Jarvis stand by"*, pause, then say *"confirm stand by Jarvis"* within 8 seconds.
  4. Test unrelated speech (e.g. discussing sleep cycles) to ensure it does not accidentally change state.
* *Note on "Voice scan unavailable":* If this warning appears, `BRIDGE_MESSAGE_LIST_PATH` is temporarily obscured (expected during file picker dialogues). If persistent when the chat is visible, recalibrate `BRIDGE_MESSAGE_LIST_PATH`.

#### 8. Live Diagnostics & Event Logging
* Run with `--verbose` to stream live JSON event logs in your terminal.
* Rotating JSONL event logs are automatically written to `~/Library/Logs/OpenAgent/bridge.jsonl` (override with `BRIDGE_LOG_FILE`). Monitor with:
  ```bash
  tail -f ~/Library/Logs/OpenAgent/bridge.jsonl
  ```
  > [!NOTE]
  > **Privacy Reminder**: Bridge event logs contain file paths, tool names, and execution errors. Review logs before sharing publicly. Audio and raw chat bodies are never logged.
* **Audio Gate Verification:** Spoken audio logs `audio_gate` with `accepted:true`, while silence logs `accepted:false`.
* **Tool Interception Verification:** Check `watcher_config`, `text_baseline`, `text_scan_result`, and `tool_dispatch`. Always send a **new harmless tool call** after startup; historical messages are baselined away and will not replay.

## One-Time Setup: Turn Instinct into Your JARVIS

Once OpenAgent is running on your Mac, there is only **one manual step** required to give Instinct full operational awareness of its new body:

1. Open [`docs/JARVIS_INSTRUCTIONS.md`](docs/JARVIS_INSTRUCTIONS.md).
2. Copy the entire initialization instruction block.
3. **Manually paste it into your WhatsApp chat with Instinct and send it.**

That is it. Instinct will immediately ingest its operational protocol:
* It learns all available local tools (`bash`, `read`, `write`, `edit`, `grep`, `glob`, `applescript`, `mac_see`, `mac_click`, `mac_browser`, `mac_python`).
* It learns to format commands in the resilient `JARVIS_CALL:<base64>:END` envelope.
* It learns how to interpret returned tool results and handle multi-step tasks.

From that moment forward, **your Instinct becomes your JARVIS**—ready to operate your Mac whenever you speak or text.

## Configuration Reference

OpenAgent reads configuration from environment variables or a root `.env` file:

| Variable | Default | Description |
| :--- | :--- | :--- |
| `BRIDGE_WHATSAPP_NUMBER` | `+16508702892` | Target phone number for your Instinct assistant. |
| `BRIDGE_SAFE_MODE` | `true` | When `true`, enforces strict chat header verification before typing or sending. |
| `BRIDGE_UNLOCKED` | `false` | When `true`, unlocks safe mode dynamically. |
| `BRIDGE_SEND_MODE` | `audio` | `audio` (sends AAC/M4A voice notes) or `text` (transcribes locally via Whisper). |
| `BRIDGE_SEND_ROUTE`| `picker` | Route for sending audio attachments: `picker`, `auto`, or `clipboard`. |
| `BRIDGE_HOTKEY` | `f8` | Push-to-talk hotkey (`f8`, `f6`, `right_shift`, `ctrl_r`, etc.). |
| `BRIDGE_LANGUAGE` | `auto` | Language code for Whisper transcription (e.g. `en`, `es`, `auto`). |
| `BRIDGE_WHISPER_MODEL` | `models/ggml-base.bin` | Path to the local Whisper GGML model file. |
| `BRIDGE_WHISPER_CLI` | `whisper-cli` | Name or path of the whisper.cpp CLI executable. |
| `BRIDGE_RECORDER` | `rec` | Binary used for microphone audio recording (from `sox`). |
| `BRIDGE_VOICE_MODEL` | `models/vosk-model-small-en-us-0.15` | Path to extracted Vosk model for offline wake-word detection. |
| `BRIDGE_VOICE_SILENCE_SECONDS` | `2.0` | Silence threshold in seconds before auto-sending in wake-word mode. |
| `BRIDGE_LOG_FILE` | `~/Library/Logs/OpenAgent/bridge.jsonl` | Rotating JSONL event diagnostics log file path. |
| `BRIDGE_LEDGER_FILE` | `~/Library/Logs/OpenAgent/processed.jsonl` | Append-only ledger file recording processed message signatures. |
| `BRIDGE_MESSAGE_LIST_PATH`| *empty* | Calibrated AX path for WhatsApp message list. |
| `BRIDGE_INCOMING_MARKER`  | *empty* | Text marker identifying incoming message bubbles. |
| `BRIDGE_VOICE_PLAY_MARKER`| *empty* | Exact AX button label for voice note Play button. |
| `BRIDGE_VOICE_PAUSE_MARKER`| *empty*| Exact AX button label for voice note Pause button. |
| `BRIDGE_ATTACH_LABEL` | *empty* | UI label for WhatsApp attachment button (e.g. `Share media`). |
| `BRIDGE_DOCUMENT_LABEL` | *empty* | UI label for Document item in attachment menu (e.g. `File`). |
| `BRIDGE_ATTACHMENT_SEND_LABEL` | *empty* | UI label for Send button in attachment preview (e.g. `Send`). |

## How to Operate & Use

### 1. Push-to-Talk (Default Mode)
* **Hold `F8`**: Speak your request to Instinct.
* **Release `F8`**: OpenAgent finishes recording, runs silence checks, encodes the audio, and sends it to Instinct.
* **Press `Esc`**: Instantly exits OpenAgent.
* *Need a different hotkey?* Run with `--hotkey f6` or `--hotkey right_shift`.

### 2. Hands-Free Wake-Word Mode (`--voice`)
* Start with:
  ```bash
  .venv/bin/python3 -m bridge.main run --voice --send-mode audio
  ```
* Say **"Wakeup Jarvis"** (or *"Hey Jarvis"*, *"Wake up"*).
* Speak your command. When you pause for 2 seconds of silence, OpenAgent automatically dispatches the audio to Instinct.
* Say **"Jarvis stand by"** followed by **"confirm"** to put the agent to sleep.

## Safety, Permissions & Control Model

OpenAgent grants Instinct real execution authority on your computer. Multiple safeguards protect your system:

* **Strict Chat Lock**: By default, `BRIDGE_SAFE_MODE=true` verifies the WhatsApp chat header matches Instinct's calibrated phone number before executing or typing anything. If you navigate to another chat, OpenAgent immediately halts.
* **Target Isolation**: `macos-harness` is strictly forbidden from sending synthetic clicks, keystrokes, or mouse events into WhatsApp Desktop (`PROHIBITED_TARGETS`).
* **Non-Focus-Stealing PID Input**: Keystrokes and clicks are routed to background process IDs (`CGEventPostToPid`). You can continue typing in your foreground window while Instinct works in the background.
* **Append-Only Ledger**: All message signatures and executed calls are written to `~/Library/Logs/OpenAgent/processed.jsonl`. Historical messages are never re-executed upon startup.
* **Silence Gating**: RMS audio gating (`gate_pcm`) prevents accidental microphone clicks or silent background noise from sending spurious requests.

> [!WARNING]
> **Security Notice**: Shell commands executed via the `bash` tool run with your Mac user account privileges. Never point OpenAgent to an unverified or shared contact.

## Running Tests & Diagnostics

OpenAgent maintains an exhaustive pytest suite covering tool dispatch, AX parsing, audio conversion, concurrency, and safety:

```bash
# Run the full test suite (125 tests)
.venv/bin/pytest
```

To run native Mac diagnostic checks:
```bash
# Check macOS permissions and runtime availability
.venv/bin/python3 -c "from bridge.mac_adapter import MacAdapter; print(MacAdapter().doctor())"
```

## Project Status

> **OpenAgent is early, active beta software.**

* **Active Development**: Protocols, tool definitions, and interfaces are actively evolving.
* **Calibration Required**: macOS Accessibility element names vary between macOS versions (Sonoma vs. Sequoia) and system languages.
* **Permissions Fragility**: macOS permissions can reset following major OS updates. If OpenAgent fails to start, verify your permissions in System Settings.
* **Target Audience**: Built for developers, researchers, and early adopters excited to explore the future of ambient, agentic personal computing.

## Contributing

Contributions and discussions are welcome!
1. Ensure all changes adhere to macOS Accessibility safety best practices.
2. Add unit tests in `tests/` for any new tools or parsers.
3. Verify that the test suite passes cleanly: `.venv/bin/pytest`.

## License

OpenAgent is open-source software licensed under the [MIT License](LICENSE).

## Credits

OpenAgent would not have been possible without the excellent open-source work that preceded it.

A significant part of OpenAgent's native macOS computer-use capabilities is built upon and directly incorporates code and implementation ideas from the following projects and teams:

- **[OpenCode](https://github.com/anomalyco/opencode)** — for their work on agentic coding infrastructure and computer-use tooling.
- **[Browser Use](https://github.com/browser-use/browser-use)** — for their work on browser automation and agentic computer interaction.
- **[Browser Use macOS Harness](https://github.com/browser-use/macos-harness)** — OpenAgent directly incorporates code from this project as the foundation for its native macOS computer-use harness, including functionality for macOS Accessibility, window interaction, keyboard and mouse control, visual perception, and browser automation.

These projects and their contributors deserve credit for the underlying work that made this part of OpenAgent possible. OpenAgent builds on that foundation and adapts, integrates, and extends it for its specific role as the local macOS execution body for Instinct.

Please refer to the respective upstream repositories and their licenses for the original implementations and attribution requirements.

**Thank you to the maintainers and contributors of these projects for making their work available to the open-source community.**