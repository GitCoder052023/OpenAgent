# OpenAgent

> **The local Mac computer-use body specifically built for Instinct.**

[![macOS](https://img.shields.io/badge/platform-macOS%20Darwin-lightgrey.svg)](https://apple.com)  
[![Python](https://img.shields.io/badge/python-3.11%2B-blue.svg)](https://www.python.org/)  
[![Bun](https://img.shields.io/badge/runtime-bun-black.svg)](https://bun.sh)  
[![Tests](https://img.shields.io/badge/tests-125%20passing-brightgreen.svg)]()  
[![Status](https://img.shields.io/badge/status-active%20beta-orange.svg)]()

---

## Index

- [What is OpenAgent?](#what-is-openagent)
- [Instinct + OpenAgent](#instinct--openagent)
- [The JARVIS Philosophy](#the-jarvis-philosophy)
- [Real-World Use Cases](#real-world-use-cases)
  - [Hands-Free Software Engineering](#1-hands-free-software-engineering)
  - [Desktop Application & Media Control](#2-desktop-application--media-control)
  - [Logged-In Browser Tasks](#3-logged-in-browser-tasks-via-chrome-cdp)
  - [Visual Desktop Troubleshooting](#4-visual-desktop-troubleshooting--ui-action)
  - [Ambient Voice-First Computing](#5-ambient-voice-first-computing)
- [Architecture](#architecture)
  - [Architecture Overview](#architecture-overview)
  - [The Execution Lifecycle](#the-execution-lifecycle)
- [Core Features](#core-features)
  - [Bridge](#1-bridge)
  - [Voice Pipeline](#2-high-speed-voice-pipeline)
  - [Headless Developer Harness](#3-headless-developer-harness)
  - [Native macOS Computer-Use Engine](#4-native-macos-computer-use-engine)
- [Tool Protocol](#tool-protocol)
  - [JARVIS_CALL](#jarvis_call)
  - [System & Developer Tools](#system--developer-tools)
  - [Native macOS Tools](#native-macos-computer-use-tools)
- [Requirements](#requirements)
- [Installation & Setup](#installation--setup)
  - [Automated Setup](#option-a-one-command-automated-launch)
  - [Manual Setup](#option-b-step-by-step-manual-setup)
  - [Voice Models](#download-voice-models)
- [Calibration & Verification](#calibration-verification--first-test-guide)
  - [Chat Verification](#1-chat-verification--lock-assertions)
  - [Whisper Calibration](#2-model-selection--accents)
  - [macOS Permissions](#3-macos-permissions--audio-routing)
  - [Accessibility Calibration](#4-ax-tree-calibration--privacy-warning)
  - [Voice-Note Watcher](#5-calibrating-the-opt-in-voice-note-watcher)
  - [Audio Sending Routes](#6-audio-file-send-routes)
  - [Hands-Free Mode](#7-phase-2-hands-free-voice-mode-trial)
  - [Diagnostics](#8-live-diagnostics--event-logging)
- [One-Time Instinct Setup](#one-time-setup-turn-instinct-into-your-jarvis)
- [Configuration Reference](#configuration-reference)
- [Operating OpenAgent](#how-to-operate--use)
  - [Push-to-Talk](#1-push-to-talk-default-mode)
  - [Hands-Free Mode](#2-hands-free-wake-word-mode)
- [Security, Permissions & Control Model](#safety-permissions--control-model)
- [Testing & Diagnostics](#running-tests--diagnostics)
- [Project Status](#project-status)
- [Contributing](#contributing)
- [License](#license)
- [Credits](#credits)

---

## What is OpenAgent?

**OpenAgent is an open-source, local execution and interaction runtime for macOS specifically engineered for [Instinct](https://instinct.com/).**

Instinct is a free, invite-only personal AI assistant and agent created by Noah Shinn and the team at Spear Street Technology, Inc. Instinct is designed to manage daily life, travel, scheduling, and personal administration through conversational interfaces.

But remote conversational agents face a fundamental limitation:

> **They are trapped in messaging threads.**

A conversational assistant can tell you how to inspect a repository, organize your Downloads folder, check a dashboard, or control a desktop application.

It cannot inherently see your screen.

It cannot inherently press a button.

It cannot inherently type into your application.

It cannot inherently operate the machine sitting in front of you.

**OpenAgent gives Instinct a native macOS body.**

OpenAgent runs locally on your Mac and sits between your active Instinct conversation and the operating system.

It receives structured tool calls from Instinct, translates them into real macOS actions, executes those actions locally, and returns the results back into the conversation.

```text
┌─────────────────────────────────┐
│        Instinct (The Mind)      │
│                                 │
│  Conversational intelligence,   │
│  planning, reasoning, dialogue  │
└────────────────┬────────────────┘
                 │
                 │ Structured tool calls
                 │ JARVIS_CALL
                 ▼
┌─────────────────────────────────┐
│       OpenAgent (The Body)      │
│                                 │
│  Local execution runtime        │
│  macOS interaction              │
│  Voice orchestration            │
│  Transport + safety             │
└────────────────┬────────────────┘
                 │
                 │ Native execution
                 ▼
┌─────────────────────────────────┐
│        macOS (The World)        │
│                                 │
│  Terminal • Files • Apps        │
│  Windows • Browser • UI         │
└─────────────────────────────────┘
```

The fundamental model is:

**Instinct thinks. OpenAgent acts. macOS is the environment.**

---

## Instinct + OpenAgent

Without OpenAgent, Instinct is an intelligent conversational agent without direct access to your local machine.

With OpenAgent, Instinct gains a local execution and computer-use layer.

| Capability | Instinct Alone | Instinct + OpenAgent |
| :--- | :--- | :--- |
| **Shell & Terminal** | Can provide shell commands for you to execute. | Executes shell commands directly through macOS `zsh`. |
| **Filesystem** | Cannot directly access local files. | Reads, writes, edits, and searches local files. |
| **Code Search** | Cannot inspect local repositories. | Searches repositories using `ripgrep` and glob patterns. |
| **Visual Perception** | Cannot see your desktop. | Captures bounded application windows with `mac_see`. |
| **Mouse & Keyboard** | Cannot interact with desktop applications. | Performs clicks, typing, shortcuts, drags, and scrolling. |
| **Accessibility** | Cannot inspect native Mac UI. | Queries and interacts with macOS Accessibility trees. |
| **Browser Automation** | Limited to remote/browser APIs. | Controls a real logged-in Chrome session through CDP. |
| **AppleScript** | Cannot directly control local Mac applications. | Executes native AppleScript through `osascript`. |
| **Compound UI Actions** | Requires multiple conversational round trips. | Executes local multi-step `mac_python` workflows. |
| **Voice** | Depends on external conversational interfaces. | Local push-to-talk and optional hands-free voice pipeline. |

This turns a conversational assistant into an agent capable of interacting with the environment where the user actually works.

---

# The JARVIS Philosophy

OpenAgent is designed around a simple idea:

> **The goal isn't to build a chatbot that occasionally runs a script. The goal is to make the computer feel like it has an intelligent assistant living alongside it.**

The assistant should be able to:

- listen when addressed
- understand the user's intent
- inspect the environment
- reason about what needs to happen
- operate applications
- execute commands
- inspect results
- continue the conversation

### Traditional Assistant

```text
User asks question
        │
        ▼
Assistant writes instructions
        │
        ▼
User performs the work
```

### Instinct + OpenAgent

```text
User states intent
        │
        ▼
Instinct reasons
        │
        ▼
Instinct issues computer actions
        │
        ▼
OpenAgent executes on macOS
        │
        ├── Terminal
        ├── Filesystem
        ├── Native UI
        ├── Browser
        └── Applications
        │
        ▼
OpenAgent returns results
        │
        ▼
Instinct reviews the result
        │
        ▼
User receives the outcome
```

The core rhythm is:

**conversation → intent → computer action → result → conversation**

---

# Real-World Use Cases

## 1. Hands-Free Software Engineering

Example:

> "Instinct, pull the latest changes on `main`, run the tests, and if anything fails, inspect the stack trace and fix it."

OpenAgent can provide the execution primitives required for that workflow:

1. `bash` runs `git pull`.
2. `bash` runs the test suite.
3. `grep` locates relevant code.
4. `read` inspects source files.
5. `edit` applies a precise patch.
6. `bash` runs the tests again.
7. Results are returned to Instinct.

The important distinction is that the assistant isn't merely generating the commands.

**It can execute the workflow.**

---

## 2. Desktop Application & Media Control

Example:

> "Instinct, play my music, close unnecessary Finder windows, and check whether Xcode is still compiling."

OpenAgent can combine:

- `applescript`
- `mac_apps`
- `mac_windows`
- `mac_ax`

to inspect and control local applications.

---

## 3. Logged-In Browser Tasks via Chrome CDP

Example:

> "Open our internal dashboard in Chrome and check today's active users."

`mac_browser` can connect to an existing Chrome session and:

- inspect tabs
- navigate
- evaluate JavaScript
- query the DOM
- extract information
- operate within an already authenticated session

The browser session remains local to the Mac.

---

## 4. Visual Desktop Troubleshooting & UI Action

Example:

> "Look at the error dialog on my screen and dismiss it if it's safe."

The workflow can be:

1. `mac_see` captures the relevant window.
2. The agent inspects the visible UI.
3. The agent determines the appropriate control.
4. `mac_click` sends a targeted click.
5. The result can be returned to the conversation.

The native input system is designed around PID-targeted interaction rather than blindly stealing the user's active focus.

---

## 5. Ambient Voice-First Computing

OpenAgent can be used as a voice-first computer interface.

Example:

> "Wake up Jarvis."

Then:

> "Find the PDFs downloaded today and move them into the Receipts folder."

OpenAgent can:

1. detect the wake phrase
2. capture speech
3. send the recording or local transcription
4. receive the resulting tool calls
5. execute them locally
6. return the result

The voice pipeline also supports interruption of active playback through barge-in.

---

# Architecture

## Architecture Overview

OpenAgent creates a local execution bridge between the conversational agent and macOS.

```text
                                  ┌───────────────────────┐
                                  │         User          │
                                  └───────────┬───────────┘
                                              │
                         ┌────────────────────┴────────────────────┐
                         │                                         │
                   Voice Input                                WhatsApp Text
                         │                                         │
                         ▼                                         ▼
              ┌─────────────────────────────────────────────────────────┐
              │                         Instinct                        │
              │                                                         │
              │              Reasoning • Planning • Dialogue            │
              └───────────────────────────┬─────────────────────────────┘
                                          │
                                          │ Structured tool calls
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              OpenAgent                                      │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         Python Bridge                                  │  │
│  │                             bridge/                                    │  │
│  │                                                                       │  │
│  │  • Voice engine                                                       │  │
│  │  • WhatsApp AX watcher                                                │  │
│  │  • JARVIS_CALL decoder                                                 │  │
│  │  • Chat verification                                                   │  │
│  │  • Deduplication ledger                                                │  │
│  │  • Response formatting                                                 │  │
│  └───────────────────────────────┬───────────────────────────────────────┘  │
│                                  │                                          │
│                    ┌─────────────┴──────────────┐                           │
│                    │                            │                           │
│                    ▼                            ▼                           │
│       ┌────────────────────────┐    ┌─────────────────────────────┐       │
│       │   Headless Harness     │    │     macOS Harness           │       │
│       │       harness/         │    │      macos-harness/         │       │
│       │                        │    │                             │       │
│       │  Bun / TypeScript      │    │  ApplicationServices / CDP  │       │
│       │                        │    │                             │       │
│       │  • bash                │    │  • mac_see                  │       │
│       │  • read                │    │  • mac_click                │       │
│       │  • write               │    │  • mac_move                 │       │
│       │  • edit                │    │  • mac_type                 │       │
│       │  • grep                │    │  • mac_key                  │       │
│       │  • glob                │    │  • mac_drag                 │       │
│       │  • applescript         │    │  • mac_scroll               │       │
│       │  • system_info         │    │  • mac_apps                 │       │
│       │                        │    │  • mac_windows              │       │
│       └────────────┬───────────┘    │  • mac_ax                  │       │
│                    │                │  • mac_browser             │       │
│                    │ JSON-RPC       │  • mac_python               │       │
│                    │ over stdio     └──────────────┬──────────────┘       │
│                    │                               │                      │
└────────────────────┼───────────────────────────────┼──────────────────────┘
                     │                               │
                     └───────────────┬───────────────┘
                                     ▼
                    ┌─────────────────────────────────┐
                    │          macOS Environment      │
                    │                                 │
                    │  Zsh • Files • Applications    │
                    │  Windows • Chrome • Native UI   │
                    └─────────────────────────────────┘
```

---

## The Execution Lifecycle

OpenAgent's normal execution path consists of several stages.

### 1. User Input

The user speaks through the local voice pipeline or sends a message through WhatsApp.

### 2. Instinct Reasoning

Instinct determines whether the requested task requires access to the user's Mac.

### 3. Tool Envelope Generation

Instinct generates a structured tool call inside the `JARVIS_CALL` transport envelope.

```text
JARVIS_CALL:<base64-encoded JSON>:END
```

### 4. Accessibility Interception

The bridge watches the WhatsApp Desktop Accessibility tree and reads incoming messages without requiring WhatsApp to remain the user's active foreground application.

### 5. Safety & Deduplication

Before executing a tool call, OpenAgent applies its local guardrails:

- chat target verification
- target isolation
- processed-message deduplication
- transport validation

### 6. Transport Decoding

The bridge:

- strips transport noise
- decodes the Base64 payload
- normalizes supported tool schemas
- validates the requested tool

### 7. Harness Routing

Developer tools are routed through the Bun/TypeScript harness.

Native computer-use tools are handled by the macOS harness.

### 8. Local Execution

The selected tool performs the requested operation.

### 9. Result Formatting

OpenAgent captures:

- tool output
- exit status
- execution duration
- diffs
- screenshots where applicable

The result is formatted for delivery back to Instinct.

### 10. Conversational Continuation

Instinct receives the result and can:

- explain the outcome
- decide on the next action
- execute another tool
- ask the user for clarification

This allows multi-step workflows to remain conversational.

---

# Core Features

## 1. Bridge

The Python bridge in `bridge/` connects WhatsApp Desktop to the local execution runtime.

### Resilient `JARVIS_CALL` Transport

WhatsApp can modify text formatting, whitespace, or Unicode representation.

OpenAgent therefore uses a Base64 payload inside a recognizable envelope:

```text
JARVIS_CALL:<base64-encoded JSON>:END
```

This provides a more reliable transport layer for structured commands.

### Zero-Focus Interaction

The bridge is designed to interact with WhatsApp without unnecessarily stealing the user's foreground focus.

### Chat Target Lock

Safe mode verifies that the current WhatsApp chat corresponds to the configured Instinct destination.

### Persistent Deduplication

Processed messages are recorded in an append-only JSONL ledger.

This prevents historical messages from being replayed after restarting the runtime.

### Response Formatting

Tool results are converted into WhatsApp-compatible responses while protecting against excessively large message payloads.

---

## 2. High-Speed Voice Pipeline

The voice system lives primarily in:

```text
bridge/audio.py
bridge/voice.py
```

### Push-to-Talk

Default hotkey:

```text
F8
```

Hold the hotkey to record.

Release it to send.

`Esc` can be used to cancel.

The hotkey can be changed through configuration or command-line arguments.

### Dual Send Modes

#### Audio Mode

The default mode records microphone input and sends it as an AAC/M4A audio attachment.

```text
audio
```

#### Text Mode

Speech can instead be transcribed locally through `whisper.cpp`.

```text
text
```

This avoids sending the raw microphone recording as the conversational payload.

### Hands-Free Wake Word

OpenAgent supports an optional Vosk-powered wake-word mode.

Example:

```text
Wakeup Jarvis
```

After activation, the system records the user's request and automatically submits it after the configured silence period.

### Silence Gating

The bridge uses RMS-based audio gating to reject:

- empty recordings
- accidental hotkey activations
- very low-energy background noise

The internal `gate_pcm` logic is used for this purpose.

### Asynchronous Playback

Voice responses are handled by a background playback worker.

This prevents voice playback from blocking incoming tool processing.

### Playback Hold

If the user begins recording while a response is being played, the active playback can be held while the new user message is processed.

### Barge-In

Pressing the recording hotkey during playback immediately interrupts active playback.

This makes conversational voice interaction feel much more natural.

---

## 3. Headless Developer Harness

The headless harness lives in:

```text
harness/
```

It is implemented in TypeScript and runs under Bun.

The bridge communicates with the harness through stdio JSON-RPC.

### `bash`

Runs shell commands through `zsh`.

Supports:

- working directory
- custom timeout
- output limits
- exit code capture

Example:

```json
{
  "tool": "bash",
  "args": {
    "command": "git status",
    "cwd": "/Users/you/project",
    "timeout_ms": 30000
  }
}
```

### `read`

Reads files and directories with pagination.

Example:

```json
{
  "tool": "read",
  "args": {
    "path": "src/main.py",
    "offset": 1,
    "limit": 100
  }
}
```

### `write`

Writes files atomically.

Example:

```json
{
  "tool": "write",
  "args": {
    "path": "config.json",
    "content": "{\n  \"active\": true\n}\n"
  }
}
```

### `edit`

Performs exact chunk replacement and returns a unified diff.

Example:

```json
{
  "tool": "edit",
  "args": {
    "path": "main.py",
    "old_string": "debug = False",
    "new_string": "debug = True"
  }
}
```

### `grep`

Uses `ripgrep` for fast code searching.

```json
{
  "tool": "grep",
  "args": {
    "pattern": "def handle_request",
    "path": "src/"
  }
}
```

### `glob`

Discovers files through glob patterns.

```json
{
  "tool": "glob",
  "args": {
    "pattern": "**/*.py",
    "path": "src/"
  }
}
```

### `applescript`

Runs native multiline AppleScript through `osascript`.

```json
{
  "tool": "applescript",
  "args": {
    "script": "tell application \"Spotify\" to play"
  }
}
```

### `system_info`

Returns local runtime and system information.

```json
{
  "tool": "system_info",
  "args": {}
}
```

---

## 4. Native macOS Computer-Use Engine

The native macOS runtime lives in:

```text
macos-harness/
```

It uses macOS public APIs including:

- ApplicationServices
- Accessibility APIs
- CoreGraphics
- Chrome DevTools Protocol

The goal is to provide direct local computer interaction rather than a cloud-based remote desktop abstraction.

---

### `mac_see`

Captures a bounded application window and extracts relevant interactive UI information.

It can return:

- screenshot data
- visible UI controls
- accessibility information
- coordinates
- optional summaries

Example:

```json
{
  "tool": "mac_see",
  "args": {
    "app": "Finder",
    "send_image": true,
    "include_summary": true
  }
}
```

---

### `mac_click`

Performs a targeted mouse click.

```json
{
  "tool": "mac_click",
  "args": {
    "x": 640,
    "y": 480,
    "app": "Notes",
    "button": "left",
    "click_count": 1
  }
}
```

---

### `mac_move`

Moves the virtual pointer overlay.

```json
{
  "tool": "mac_move",
  "args": {
    "x": 640,
    "y": 480,
    "app": "Notes"
  }
}
```

---

### `mac_type`

Types text into a target application.

```json
{
  "tool": "mac_type",
  "args": {
    "text": "Hello Instinct!",
    "app": "Notes"
  }
}
```

---

### `mac_key`

Sends keyboard shortcuts.

```json
{
  "tool": "mac_key",
  "args": {
    "key": "cmd+s",
    "app": "Notes"
  }
}
```

---

### `mac_drag`

Performs a drag operation.

```json
{
  "tool": "mac_drag",
  "args": {
    "start_x": 100,
    "start_y": 100,
    "end_x": 300,
    "end_y": 100,
    "app": "Finder"
  }
}
```

---

### `mac_scroll`

Sends a scroll operation.

```json
{
  "tool": "mac_scroll",
  "args": {
    "x": 500,
    "y": 500,
    "dx": 0,
    "dy": -5,
    "app": "Safari"
  }
}
```

---

### `mac_apps`

Lists running applications.

```json
{
  "tool": "mac_apps",
  "args": {}
}
```

---

### `mac_windows`

Lists windows belonging to an application.

```json
{
  "tool": "mac_windows",
  "args": {
    "app": "Google Chrome"
  }
}
```

---

### `mac_ax`

Queries and interacts with macOS Accessibility elements.

```json
{
  "tool": "mac_ax",
  "args": {
    "action": "query",
    "app": "Finder",
    "text": "Downloads"
  }
}
```

This allows the agent to operate on semantic UI elements instead of relying exclusively on coordinates.

---

### `mac_browser`

Provides Chrome DevTools Protocol automation.

Example:

```json
{
  "tool": "mac_browser",
  "args": {
    "action": "navigate",
    "url": "https://github.com"
  }
}
```

The browser tool can operate against a running Chrome session and therefore supports workflows involving an already authenticated browser profile.

---

### `mac_python`

Provides compound local UI execution.

Example:

```json
{
  "tool": "mac_python",
  "args": {
    "code": "mac.click(400, 300, app='Notes')\nmac.type('Meeting Notes', app='Notes')\nmac.key('enter', app='Notes')"
  }
}
```

Instead of making every UI operation travel through the conversational transport separately, a compound workflow can execute locally.

This is particularly useful for:

- repetitive UI sequences
- multi-step application workflows
- latency-sensitive interaction

---

### `LivePointerOverlay`

The native harness includes a visual pointer overlay that can display where the agent is interacting.

This provides a human-visible indication of computer-use activity without moving the user's physical mouse.

---

### Target Isolation

The native harness contains explicit prohibited-target protection.

The bridge communication application itself is treated as a protected target so that computer-use actions cannot accidentally type into or click the communication channel that is carrying the agent's instructions.

---

# Tool Protocol

## `JARVIS_CALL`

Instinct communicates with OpenAgent using structured JSON wrapped in a Base64 transport envelope.

```text
JARVIS_CALL:<base64-encoded JSON>:END
```

Conceptually, the decoded payload looks like:

```json
{
  "tool": "bash",
  "args": {
    "command": "uname -a"
  }
}
```

The transport layer exists because conversational messaging systems are not designed to be reliable binary/structured RPC transports.

OpenAgent therefore treats the WhatsApp message as a transport layer and performs decoding and normalization before execution.

---

## Supported Tools

### System & Developer Tools

| Tool | Purpose |
| :--- | :--- |
| `bash` | Execute shell commands |
| `read` | Read files/directories |
| `write` | Write files |
| `edit` | Exact text replacement with diff |
| `grep` | Search source/code |
| `glob` | Discover files |
| `applescript` | Execute native AppleScript |
| `system_info` | Inspect runtime/system information |

### Native macOS Tools

| Tool | Purpose |
| :--- | :--- |
| `mac_see` | Screenshot and visual UI inspection |
| `mac_click` | Targeted mouse click |
| `mac_move` | Virtual pointer movement |
| `mac_type` | Targeted text input |
| `mac_key` | Keyboard shortcuts |
| `mac_drag` | Drag operations |
| `mac_scroll` | Scroll operations |
| `mac_apps` | Running application list |
| `mac_windows` | Application window inspection |
| `mac_ax` | macOS Accessibility interaction |
| `mac_browser` | Chrome CDP automation |
| `mac_python` | Compound local UI execution |

---

# Requirements

## Operating System

Supported environments currently include:

- macOS 14 Sonoma
- macOS 15 Sequoia

Hardware:

- Apple Silicon M1/M2/M3/M4
- Intel Macs where supported by the underlying macOS APIs

---

## WhatsApp Desktop

OpenAgent currently relies on the official macOS WhatsApp Desktop application for its communication bridge.

WhatsApp must be:

- installed
- logged in
- accessible to macOS Accessibility APIs
- connected to the Instinct conversation

The configured destination number must match the calibrated chat header when safe mode is enabled.

---

## Runtime Dependencies

### Python

Python:

```text
3.11+
```

### Bun

The headless harness requires Bun.

Install it through the official Bun installation instructions or:

```bash
curl -fsSL https://bun.sh/install | bash
```

---

## Homebrew Dependencies

The standard installation uses:

```bash
brew install python sox ffmpeg ripgrep whisper-cpp
```

These provide:

| Dependency | Purpose |
| :--- | :--- |
| `python` | OpenAgent bridge/runtime |
| `sox` | Microphone recording |
| `ffmpeg` | Audio encoding |
| `ripgrep` | Fast code/file search |
| `whisper-cpp` | Optional local speech-to-text |

---

## Required macOS Permissions

Open:

```text
System Settings
→ Privacy & Security
```

OpenAgent may require:

### Accessibility

Required for:

- WhatsApp UI inspection
- Accessibility tree access
- native UI interaction
- application control

### Input Monitoring

Required for:

- global push-to-talk hotkeys

### Microphone

Required for:

- local voice recording

### Screen Recording

Required for:

- `mac_see`
- background window capture

### Automation

Required for workflows involving:

- WhatsApp
- System Events
- AppleScript-controlled applications

---

# Installation & Setup

## Option A: One-Command Automated Launch

The repository includes `start.sh` for automated setup.

```bash
chmod +x start.sh
./start.sh
```

For local transcription mode:

```bash
./start.sh --send-mode text
```

The launcher handles the standard environment preparation and runtime checks.

After setup, continue to:

[One-Time Instinct Setup](#one-time-setup-turn-instinct-into-your-jarvis)

---

# Option B: Step-by-Step Manual Setup

## 1. Install System Dependencies

```bash
brew install python sox ffmpeg ripgrep whisper-cpp
curl -fsSL https://bun.sh/install | bash
```

---

## 2. Clone OpenAgent

```bash
git clone https://github.com/GitCoder052023/OpenAgent.git
cd OpenAgent
```

---

## 3. Create the Python Environment

```bash
python3 -m venv .venv
source .venv/bin/activate
```

Install OpenAgent:

```bash
pip install -e '.[dev,voice]' -e ./macos-harness
```

The second editable installation installs the native macOS computer-use engine alongside the bridge.

---

## 4. Install Harness Dependencies

```bash
cd harness
bun install
cd ..
```

---

## 5. Configure Environment Variables

Create the environment file:

```bash
cp .env.example .env
```

Then configure the required values.

See:

[Configuration Reference](#configuration-reference)

---

# Download Voice Models

## Whisper

Use the provided helper:

```bash
bash scripts/download-model.sh base
```

Supported targets include:

```text
base
small
base.en
small.en
```

The `base` model is the recommended multilingual starting point.

For English-only transcription:

```bash
bash scripts/download-model.sh base.en
```

The script downloads the appropriate GGML model into:

```text
models/
```

---

## Vosk

Hands-free wake-word mode uses a local Vosk model.

Example:

```bash
mkdir -p models

curl -L \
  https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip \
  -o models/vosk.zip

unzip models/vosk.zip -d models/
rm models/vosk.zip
```

The expected model directory is:

```text
models/vosk-model-small-en-us-0.15
```

---

# Inspect WhatsApp Accessibility

Before starting OpenAgent, verify that macOS Accessibility can inspect WhatsApp:

```bash
.venv/bin/python3 -m bridge.main inspect > ax-tree.json
```

If this succeeds, OpenAgent can read the relevant Accessibility tree.

> [!CAUTION]
> `ax-tree.json` can contain private WhatsApp message text. Keep it local, never commit it, never share it publicly, and delete it after calibration.

---

# Run OpenAgent

## Push-to-Talk

```bash
.venv/bin/python3 -m bridge.main run
```

Default:

```text
F8 = Push to Talk
```

---

## Hands-Free Voice

```bash
.venv/bin/python3 -m bridge.main run \
  --voice \
  --send-mode audio
```

---

# Calibration, Verification & First Test Guide

OpenAgent depends on local macOS Accessibility structures and therefore requires calibration against the exact WhatsApp Desktop build and macOS environment being used.

Do not weaken the safety checks simply to make an installation work.

---

## 1. Chat Verification & Lock Assertions

Open the official WhatsApp Desktop application.

Navigate to the Instinct conversation.

Verify that the expected phone number appears explicitly in the selected chat header.

The default configuration uses:

```text
+16508702892
```

If only a saved contact name appears and the raw number cannot be verified:

> **Stop rather than weakening the lock.**

Do not disable the phone-number verification merely to make a test pass.

During initial calibration, keep WhatsApp visible and foregrounded.

---

## 2. Model Selection & Accents

Download the recommended model:

```bash
bash scripts/download-model.sh base
```

Then configure:

```env
BRIDGE_WHISPER_MODEL=models/ggml-base.bin
BRIDGE_LANGUAGE=auto
```

Available model targets include:

```text
base
base.en
small
small.en
```

For multilingual speech or Hinglish, `auto` language detection is recommended.

---

## 3. macOS Permissions & Audio Routing

Grant the required permissions under:

```text
System Settings
→ Privacy & Security
```

At minimum, verify:

- Microphone
- Accessibility
- Input Monitoring
- Automation
- Screen Recording when using `mac_see`

If permissions appear to be ignored, restart the terminal/application responsible for running OpenAgent.

For voice playback, verify that the intended Bluetooth headphones or speakers are selected as the macOS system output.

---

# 4. AX Tree Calibration & Privacy Warning

Generate a fresh Accessibility snapshot:

```bash
.venv/bin/python3 -m bridge.main inspect > ax-tree.json
```

> [!CAUTION]
> The Accessibility snapshot may contain raw WhatsApp UI content, including private messages. Treat it as sensitive local data.

Find the selected chat header's exact-number Accessibility element.

Then configure:

```env
BRIDGE_HEADER_PATH=<calibrated AX path>
```

### Verify the Lock

Switch to a different WhatsApp conversation.

Run the inspection again.

OpenAgent should refuse to operate because the active chat no longer matches the configured destination.

If it does not, **do not continue operating the agent** until the calibration is corrected.

---

## Hotkey Calibration

On some Apple keyboards, function keys may require:

```text
Fn + F8
```

You can use another key through:

```env
BRIDGE_HOTKEY=f6
```

or:

```env
BRIDGE_HOTKEY=right_shift
```

Other supported examples include:

```text
f6
f8
right_shift
ctrl_r
```

---

# 5. Calibrating the Opt-In Voice-Note Watcher

The incoming voice-note watcher relies on Accessibility metadata exposed by WhatsApp.

Prepare harmless test messages in the calibrated chat.

You may need to identify:

- message list container
- incoming message marker
- voice-note Play control
- voice-note Pause control

Configure:

```env
BRIDGE_MESSAGE_LIST_PATH=<AX message list path>
BRIDGE_INCOMING_MARKER=<incoming marker>
BRIDGE_VOICE_PLAY_MARKER=<play label>
BRIDGE_VOICE_PAUSE_MARKER=<pause label>
```

The message list may appear as an:

- `AXList`
- `AXScrollArea`
- `AXGroup`

### Important

The incoming marker should be a direction-specific Accessibility title/description rather than text from the message body.

This helps distinguish incoming from outgoing messages.

### If WhatsApp Doesn't Expose Reliable Markers

Leave the relevant values empty and use manual playback.

OpenAgent should not guess.

---

## Historical Message Protection

The watcher baselines visible messages when it starts.

This means:

> Historical messages should not be replayed after startup.

Only new events observed after initialization should become candidates for processing.

---

# 6. Audio-File Send Routes

Recorded M4A files can be sent through different WhatsApp routes.

Configure:

```env
BRIDGE_SEND_ROUTE=picker
```

for the default picker-based flow.

Supported values:

```text
picker
clipboard
auto
```

---

## Picker Route

```env
BRIDGE_SEND_ROUTE=picker
```

The picker route uses WhatsApp's native attachment/document interface.

You may need to calibrate:

```env
BRIDGE_ATTACH_LABEL=<attachment button label>
BRIDGE_DOCUMENT_LABEL=<document item label>
BRIDGE_ATTACHMENT_SEND_LABEL=<send button label>
```

---

## Clipboard Route

```env
BRIDGE_SEND_ROUTE=clipboard
```

The clipboard route stages the M4A through the macOS pasteboard and uses:

```text
Cmd + V
```

to attach the file.

---

## Automatic Route

```env
BRIDGE_SEND_ROUTE=auto
```

The automatic route attempts clipboard attachment first and falls back to the picker when necessary.

Possible paste states include:

### `preview`

The file was successfully attached.

### `polluted`

The paste became raw text in the composer.

OpenAgent clears the draft and falls back to the picker.

### `empty`

WhatsApp ignored the paste.

OpenAgent retries once and then falls back.

### `ambiguous`

The attachment state cannot be reliably determined.

OpenAgent halts rather than risking a duplicate message.

---

# 7. Phase 2: Hands-Free Voice Mode Trial

Install the voice dependencies:

```bash
pip install -e '.[voice]' -e ./macos-harness
```

Make sure the Vosk model is available:

```text
models/vosk-model-small-en-us-0.15
```

Configure:

```env
BRIDGE_VOICE_MODEL=models/vosk-model-small-en-us-0.15
```

Run:

```bash
.venv/bin/python3 -m bridge.main run \
  --voice \
  --send-mode audio
```

A headset is recommended during initial testing.

---

## Suggested Test Sequence

### Test 1: Wake Word

Say:

```text
Wakeup Jarvis
```

Then pause.

### Test 2: Command

Speak a short harmless test command.

Pause for the configured silence period.

### Test 3: Standby

Say:

```text
Jarvis stand by
```

Then confirm the standby transition.

### Test 4: False Activation

Say unrelated phrases around the microphone.

Verify that OpenAgent does not accidentally change state or submit a request.

---

## Voice Scan Warning

If you see:

```text
Voice scan unavailable
```

the message list may temporarily be obscured by another UI such as a file picker.

If the warning persists while the target WhatsApp chat is visible, recalibrate:

```env
BRIDGE_MESSAGE_LIST_PATH
```

---

# 8. Live Diagnostics & Event Logging

Run OpenAgent with verbose logging when debugging:

```bash
.venv/bin/python3 -m bridge.main run --verbose
```

The bridge writes rotating JSONL diagnostics to:

```text
~/Library/Logs/OpenAgent/bridge.jsonl
```

Follow the log:

```bash
tail -f ~/Library/Logs/OpenAgent/bridge.jsonl
```

Override the location with:

```env
BRIDGE_LOG_FILE=<path>
```

---

## Privacy Reminder

Bridge logs may contain:

- file paths
- tool names
- execution errors
- diagnostic state

They should be reviewed before being shared publicly.

Raw audio and raw chat bodies are not intended to be logged.

---

## Audio Gate Verification

The event log records audio gate decisions.

Accepted audio:

```text
audio_gate
accepted:true
```

Rejected/silent audio:

```text
audio_gate
accepted:false
```

---

## Tool Interception Verification

Useful events include:

```text
watcher_config
text_baseline
text_scan_result
tool_dispatch
```

Always send a **new harmless tool call** after startup when testing interception.

Historical messages are baselined and should not replay.

---

# One-Time Setup: Turn Instinct into Your JARVIS

Once OpenAgent is running, Instinct needs to be told about its new local execution environment.

The repository contains:

```text
docs/JARVIS_INSTRUCTIONS.md
```

Open it and copy the initialization instruction block.

Then manually paste it into the WhatsApp conversation with Instinct.

That initialization teaches Instinct:

- which local tools are available
- how to format `JARVIS_CALL`
- how tool results are returned
- how to compose multi-step workflows
- how to interact with the OpenAgent runtime

Available tool families include:

```text
bash
read
write
edit
grep
glob
applescript
system_info

mac_see
mac_click
mac_move
mac_type
mac_key
mac_drag
mac_scroll
mac_apps
mac_windows
mac_ax
mac_browser
mac_python
```

After initialization, Instinct can use OpenAgent as its local execution body.

---

# Configuration Reference

OpenAgent reads configuration from environment variables and/or the root `.env` file.

| Variable | Default | Description |
| :--- | :--- | :--- |
| `BRIDGE_WHATSAPP_NUMBER` | `+16508702892` | Target phone number for the Instinct assistant. |
| `BRIDGE_SAFE_MODE` | `true` | Enforces strict chat header verification. |
| `BRIDGE_UNLOCKED` | `false` | Dynamically unlocks safe mode when explicitly enabled. |
| `BRIDGE_SEND_MODE` | `audio` | `audio` sends AAC/M4A; `text` uses local Whisper transcription. |
| `BRIDGE_SEND_ROUTE` | `picker` | Attachment route: `picker`, `auto`, or `clipboard`. |
| `BRIDGE_HOTKEY` | `f8` | Push-to-talk hotkey. |
| `BRIDGE_LANGUAGE` | `auto` | Whisper language configuration. |
| `BRIDGE_WHISPER_MODEL` | `models/ggml-base.bin` | Local Whisper GGML model. |
| `BRIDGE_WHISPER_CLI` | `whisper-cli` | Whisper executable name/path. |
| `BRIDGE_RECORDER` | `rec` | SoX recording executable. |
| `BRIDGE_VOICE_MODEL` | `models/vosk-model-small-en-us-0.15` | Local Vosk model path. |
| `BRIDGE_VOICE_SILENCE_SECONDS` | `2.0` | Silence duration before auto-submitting voice input. |
| `BRIDGE_LOG_FILE` | `~/Library/Logs/OpenAgent/bridge.jsonl` | Diagnostic JSONL log path. |
| `BRIDGE_LEDGER_FILE` | `~/Library/Logs/OpenAgent/processed.jsonl` | Append-only processed-message ledger. |
| `BRIDGE_MESSAGE_LIST_PATH` | empty | Calibrated AX path for WhatsApp's message list. |
| `BRIDGE_INCOMING_MARKER` | empty | Accessibility marker identifying incoming messages. |
| `BRIDGE_VOICE_PLAY_MARKER` | empty | Accessibility label for voice-note Play. |
| `BRIDGE_VOICE_PAUSE_MARKER` | empty | Accessibility label for voice-note Pause. |
| `BRIDGE_ATTACH_LABEL` | empty | WhatsApp attachment button label. |
| `BRIDGE_DOCUMENT_LABEL` | empty | WhatsApp document/file menu label. |
| `BRIDGE_ATTACHMENT_SEND_LABEL` | empty | Send button label in attachment preview. |
| `BRIDGE_HEADER_PATH` | empty | Calibrated Accessibility path for the target chat header. |

---

# How to Operate & Use

## 1. Push-to-Talk Default Mode

Start:

```bash
.venv/bin/python3 -m bridge.main run
```

Then:

### Hold `F8`

Speak your request.

### Release `F8`

OpenAgent:

1. stops recording
2. performs the audio gate check
3. encodes the recording
4. sends the resulting audio/message to Instinct

### Press `Esc`

Exit OpenAgent.

---

## Custom Hotkey

Example:

```bash
.venv/bin/python3 -m bridge.main run --hotkey f6
```

Or:

```bash
.venv/bin/python3 -m bridge.main run --hotkey right_shift
```

---

# 2. Hands-Free Wake-Word Mode

Start:

```bash
.venv/bin/python3 -m bridge.main run \
  --voice \
  --send-mode audio
```

Say:

```text
Wakeup Jarvis
```

Then speak naturally.

When the configured silence duration is reached, the request is automatically submitted.

To enter standby:

```text
Jarvis stand by
```

followed by the configured confirmation phrase.

---

# Safety, Permissions & Control Model

OpenAgent grants an AI agent real execution authority over the local machine.

Treat this accordingly.

## Strict Chat Lock

By default:

```env
BRIDGE_SAFE_MODE=true
```

OpenAgent verifies that the active WhatsApp chat matches the configured destination.

If the user navigates to a different chat, the bridge should halt rather than send or execute through the wrong conversation.

---

## Target Isolation

The native computer-use layer protects designated applications through:

```text
PROHIBITED_TARGETS
```

The purpose is to prevent synthetic mouse/keyboard events from accidentally interacting with the communication channel itself.

---

## PID-Targeted Input

Native interaction can target application process IDs through mechanisms such as:

```text
CGEventPostToPid
```

This allows background interaction without intentionally moving the user's physical cursor or stealing foreground focus.

---

## Append-Only Execution Ledger

Processed message/tool signatures are recorded in:

```text
~/Library/Logs/OpenAgent/processed.jsonl
```

This provides persistent idempotency across process restarts.

Historical messages should not be replayed simply because OpenAgent was restarted.

---

## Audio Silence Gating

RMS-based audio gating helps reject:

- silence
- accidental triggers
- low-energy noise
- empty microphone recordings

---

> [!WARNING]
> Commands executed through `bash` run with the privileges of the local macOS user. Do not connect OpenAgent to an unverified or untrusted contact, and do not execute untrusted agent instructions blindly.

---

## Security Philosophy

OpenAgent should prefer:

> **Fail closed rather than guess.**

If the target application, chat, message, attachment state, or execution context is ambiguous, the correct behavior is to stop and require a reliable state rather than attempt a potentially destructive action.

For a dedicated security policy, see:

```text
SECURITY.md
```

---

# Running Tests & Diagnostics

OpenAgent includes a pytest suite covering major runtime components.

Run:

```bash
.venv/bin/pytest
```

The current project status tracks:

```text
125 tests
```

Coverage includes areas such as:

- tool dispatch
- AX parsing
- audio processing
- transport parsing
- concurrency
- safety behavior
- bridge logic

---

## Native macOS Diagnostic Check

Run:

```bash
.venv/bin/python3 -c \
"from bridge.mac_adapter import MacAdapter; print(MacAdapter().doctor())"
```

This can help identify:

- runtime availability
- macOS integration issues
- permission problems
- native adapter failures

---

# Logging & Diagnostics

OpenAgent's primary bridge event log is:

```text
~/Library/Logs/OpenAgent/bridge.jsonl
```

The processed-call ledger is:

```text
~/Library/Logs/OpenAgent/processed.jsonl
```

Follow the bridge log live:

```bash
tail -f ~/Library/Logs/OpenAgent/bridge.jsonl
```

Use verbose execution during debugging:

```bash
.venv/bin/python3 -m bridge.main run --verbose
```

---

## What to Check When Tool Calls Are Not Executing

Check the following in order:

1. WhatsApp Desktop is open and logged in.
2. The correct Instinct conversation is selected.
3. Accessibility permission is granted.
4. `BRIDGE_SAFE_MODE` is configured correctly.
5. `BRIDGE_HEADER_PATH` matches the current WhatsApp Accessibility tree.
6. The message list path is correctly calibrated.
7. The new tool call is actually being detected.
8. The tool payload decodes correctly.
9. The target harness is running.
10. The bridge log contains a `tool_dispatch` event.
11. The processed ledger has not already recorded the same message.
12. The relevant macOS permission has not been reset.

---

# Project Structure

The major runtime components are organized approximately as follows:

```text
OpenAgent/
│
├── bridge/
│   ├── main.py
│   ├── dispatcher.py
│   ├── replies.py
│   ├── audio.py
│   ├── voice.py
│   └── ...
│
├── harness/
│   ├── ...
│   └── package.json
│
├── macos-harness/
│   ├── ...
│   └── pyproject.toml
│
├── models/
│   └── ...
│
├── scripts/
│   └── download-model.sh
│
├── docs/
│   └── JARVIS_INSTRUCTIONS.md
│
├── tests/
│   └── ...
│
├── .env.example
├── start.sh
├── SECURITY.md
├── LICENSE
└── README.md
```

The exact internal module layout may evolve while OpenAgent remains in active beta.

---

# Design Principles

OpenAgent is built around several architectural principles.

## Local First

Computer-use execution happens locally on the Mac.

The runtime does not require a remote desktop server to perform native macOS actions.

---

## Explicit Tool Boundaries

Capabilities are exposed through named tool primitives rather than an unrestricted "do anything" interface.

This gives the agent a structured action surface.

---

## Fail Closed

When the runtime cannot confidently determine:

- the target chat
- the target application
- the attachment state
- the message state
- the execution state

it should stop rather than guess.

---

## Persistent Idempotency

Agentic systems can encounter retries, duplicated messages, application restarts, or transport anomalies.

OpenAgent therefore persists processed-call information rather than relying only on in-memory state.

---

## Background Interaction

Where technically possible, computer-use actions target the intended process/application rather than disrupting the user's current foreground workflow.

---

## Native macOS APIs

The native computer-use layer is designed around macOS APIs such as:

- Accessibility
- ApplicationServices
- CoreGraphics
- Chrome DevTools Protocol

rather than requiring a cloud-hosted computer environment.

---

# Project Status

> **OpenAgent is early, active beta software.**

The project is functional but its interfaces are still evolving.

## Active Development

The following areas may change:

- tool schemas
- transport protocol
- bridge internals
- macOS harness APIs
- voice pipeline
- configuration variables
- calibration behavior

---

## Calibration Required

macOS Accessibility trees can vary between:

- macOS versions
- WhatsApp versions
- application UI states
- system languages
- accessibility configurations

As a result, some installations require local AX calibration.

---

## Permission Fragility

Major macOS upgrades can reset or modify privacy permissions.

If OpenAgent suddenly stops working after an OS update, verify:

```text
System Settings
→ Privacy & Security
```

before debugging the application itself.

---

## Target Audience

OpenAgent is primarily intended for:

- developers
- researchers
- agent builders
- computer-use enthusiasts
- early adopters
- people experimenting with ambient personal computing

---

# Contributing

Contributions, bug reports, experiments, and discussions are welcome.

When contributing:

1. Follow macOS Accessibility safety practices.
2. Add tests for new tools, parsers, and safety-critical behavior.
3. Avoid weakening target isolation or chat verification.
4. Keep computer-use behavior deterministic where possible.
5. Run the test suite before submitting changes.

Run:

```bash
.venv/bin/pytest
```

for the full test suite.

---

## Adding a New Tool

When adding a new tool, consider:

### Tool Schema

Define explicit arguments and predictable output.

### Error Handling

Return useful structured errors instead of silently failing.

### Safety

Determine whether the tool can:

- delete data
- send messages
- execute arbitrary commands
- interact with sensitive applications
- bypass existing safety boundaries

### Idempotency

Consider whether retries can cause duplicated side effects.

### Tests

Add coverage for:

- normal execution
- invalid arguments
- failure paths
- safety restrictions
- repeated execution where applicable

---

# License

OpenAgent is open-source software licensed under the [MIT License](LICENSE).

---

# Credits

OpenAgent builds on the work of the open-source computer-use and agent tooling community.

A significant portion of the native macOS computer-use foundation used by OpenAgent comes from prior open-source work, particularly the **Browser Use / macOS harness ecosystem**, whose implementation provided important foundations for capabilities such as:

- macOS Accessibility interaction
- native window interaction
- keyboard and mouse control
- visual perception
- browser automation

OpenAgent also draws from the broader work of **OpenCode** and the open-source agent tooling ecosystem around agentic coding and computer-use systems.

### Upstream Projects

- **[OpenCode](https://github.com/anomalyco/opencode)** — agentic coding infrastructure and related tooling.
- **[Browser Use](https://github.com/browser-use/browser-use)** — browser automation and agentic computer interaction.
- **[Browser Use macOS Harness](https://github.com/browser-use/macos-harness)** — native macOS computer-use foundations incorporated into OpenAgent.

OpenAgent adapts, integrates, and extends these foundations for its specific role as the local macOS execution body for Instinct.

Please refer to the respective upstream repositories and their licenses for original implementation details and attribution requirements.

**Thank you to the maintainers and contributors of these projects for making their work available to the open-source community.**

---

# OpenAgent

**Instinct thinks. OpenAgent acts. macOS is the world.**

```text
conversation
     ↓
reasoning
     ↓
JARVIS_CALL
     ↓
OpenAgent
     ↓
macOS
     ↓
result
     ↓
conversation
```

Made for the future of local, ambient, agentic computing.