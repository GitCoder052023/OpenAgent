<img src="https://raw.githubusercontent.com/browser-use/macos-harness/main/static/banner-ink.svg" alt="macOS Harness" width="100%" />

# OpenAgent ⌘

**The open-source, local macOS computer-use body for AI agents.**

[![macOS](https://img.shields.io/badge/platform-macOS%20Darwin-lightgrey.svg?style=flat-square&logo=apple)](https://apple.com)
[![Python](https://img.shields.io/badge/python-3.11%2B-blue.svg?style=flat-square&logo=python)](https://www.python.org/)
[![uv](https://img.shields.io/badge/package%20manager-uv-blueviolet.svg?style=flat-square)](https://astral.sh/uv)
[![Bun](https://img.shields.io/badge/runtime-bun-black.svg?style=flat-square&logo=bun)](https://bun.sh)
[![Tests](https://img.shields.io/badge/tests-136%20passing-brightgreen.svg?style=flat-square)]()
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
┌────────────────────────────────────────────────────────────────────────┐
│                          Instinct (The Mind)                           │
│                 Reasoning • Planning • Dialogue Logic                  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    │ Secure JARVIS_CALL transport
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                          OpenAgent (The Body)                          │
│               Voice Pipeline • Safety Guard • Harness IPC              │
└──────┬───────────────────────┬──────────────────────┬────────────────┬─┘
       │                       │                      │                │
       ▼                       ▼                      ▼                ▼
┌──────────────┐      ┌─────────────────┐    ┌─────────────────┐┌───────────────┐
│ Headless Dev │      │ Native Computer │    │ Real Browser    ││ Firecrawl Web │
│ (Bun / TS)   │      │ (macOS APIs)    │    │ (CDP Harness)   ││ (Self-Hosted) │
│ Shell • Code │      │ Clicks • Vision │    │ Tabs • AX • DOM ││ Scrape • Crawl│
└──────┬───────┘      └────────┬────────┘    └────────┬────────┘└───────┬───────┘
       └───────────────────────┼──────────────────────┴─────────────────┘
                               ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      macOS, Chrome & The Web (The World)               │
│                  Your Local System, Apps, Web & Logins                 │
└────────────────────────────────────────────────────────────────────────┘
```

> **Instinct thinks. OpenAgent acts.**

## Core Features

* **Real Browser Control (CDP Harness)**: Connects directly to your real, authenticated Chrome browser. Operates background tabs (`new_tab`, `switch_tab`), dispatches compositor clicks, queries internal Accessibility trees (`browser_ax`), fills framework-controlled forms cleanly (`browser_fill`), and uses pre-built domain skills for 80+ platforms (Amazon, GitHub, YouTube, X, etc.) without stealing physical focus.
* **Self-Hosted Web Ingestion & Extraction (Firecrawl Engine)**: 100% local, self-hosted web scraper and crawler engine running on Docker. Turns any web page into clean, LLM-ready Markdown in one shot (`firecrawl_scrape`), performs web searches with full Markdown results (`firecrawl_search`), runs recursive domain crawlers (`firecrawl_crawl`), maps site architectures (`firecrawl_map`), and extracts structured JSON schemas (`firecrawl_extract`) without cloud API limits.
* **High-Speed Voice Pipeline**: Hold **`F8`** to talk (Push-to-Talk) or use hands-free wake word (*"Wake up Jarvis"*). Features local RMS silence gating, background audio playback, and instant barge-in interruption.
* **Headless Developer Harness**: Ultra-fast Bun + TypeScript runner providing sandboxed `bash` execution, granular file pagination (`read`), atomic `write`, exact diff patching (`edit`), and fast `ripgrep` search.
* **Native macOS Computer-Use**: Inspect application windows (`mac_see`), query semantic UI trees (`mac_ax`), issue PID-targeted clicks and keystrokes across applications (including WhatsApp Desktop), and capture screenshots sent directly to WhatsApp.
* **Fail-Closed Safety**: Chat-lock verification ensures commands only execute from your authorized Instinct chat, with web target restrictions blocking automated access to WhatsApp Web.
* **Zero-Cloud Intermediary**: All tool execution, browser control, screen parsing, and audio handling happen locally on your hardware.

## Quick Start

### Prerequisites

* macOS 14 (Sonoma) or macOS 15 (Sequoia) on Apple Silicon or Intel
* [uv](https://astral.sh/uv) (Astral Python package and project manager)
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

`start.sh` automatically checks dependencies, synchronizes the Python environment via `uv`, installs the native harness, configures `.env`, tests stdio IPC, and spins up the runtime.

```bash
# 1. Install system utilities
brew install uv sox ffmpeg ripgrep whisper-cpp
curl -fsSL https://bun.sh/install | bash

# 2. Setup Python environment with uv
uv sync --all-extras

# 3. Install Bun CLI harness dependencies
cd src/tools/cli-harness && bun install && cd ../..

# 4. Configure environment
cp .env.example .env

# 5. Start OpenAgent
uv run python -m OpenAgent.main run
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

1. Run `./start.sh` (or `uv run python -m OpenAgent.main run`).
2. **Hold `F8`** and speak your request.
3. **Release `F8`** to encode and dispatch the request to Instinct.
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
| `mac_python` | Run compound, multi-step UI workflows locally in Python | `code` |

### Real Browser Control Tools (Browser Harness CDP)

| Tool | Description | Key Arguments |
| --- | --- | --- |
| `browser_open` | Navigate or open a new tab in your authenticated Chrome session | `url`, `new_tab` |
| `browser_info` | Inspect page URL, title, viewport dimensions, and scroll offset | *(none)* |
| `browser_click` | Composited CDP mouse click bypassing iframes/shadow DOM | `x`, `y`, `selector`, `button`, `click_count` |
| `browser_fill` | Framework-safe form input (React/Vue synthetic events) | `selector`, `text`, `clear_first`, `timeout` |
| `browser_type` | Type text into currently focused web element | `text` |
| `browser_key` | Trigger web keyboard shortcuts (`Enter`, `Escape`, `Tab`, `Backspace`) | `key`, `modifiers` |
| `browser_scroll` | Scroll by delta pixels or scroll element into view | `dx`, `dy`, `selector` |
| `browser_tabs` | Background tab management (`list`, `new`, `switch`, `close`, `current`) | `action`, `target`, `url` |
| `browser_see` | Inspect tab state and send visual screenshot to WhatsApp | `send_image`, `max_elements` |
| `browser_ax` | Discover buttons/inputs via internal Accessibility Tree | `action`, `text`, `role`, `limit` |
| `browser_eval` | Evaluate JavaScript in the active tab context | `expression` |
| `browser_wait` | Wait for page load, network idle, or element appearance | `for_what`, `selector`, `timeout` |
| `browser_python` | Ultra-fast compound browser burst execution (<200ms) | `code`, `timeout` |
| `domain_skills` | Retrieve pre-built domain automation skills for 80+ platforms | `host` |

### Self-Hosted Web Ingestion & Extraction Tools (Firecrawl Engine)

| Tool | Description | Key Arguments |
| --- | --- | --- |
| `firecrawl_scrape` | Scrape dynamic web pages directly into clean LLM Markdown | `url`, `formats`, `only_main_content`, `wait_for` |
| `firecrawl_search` | Search the web and return full Markdown from top hits in one shot | `query`, `limit`, `scrape_options` |
| `firecrawl_crawl` | Asynchronously crawl an entire domain or documentation tree | `url`, `max_depth`, `limit` |
| `firecrawl_status` | Check the progress and page count of an ongoing crawl | `job_id` |
| `firecrawl_map` | Fast sitemap and URL discovery across a domain | `url`, `search`, `limit` |
| `firecrawl_extract` | Extract structured JSON data matching a schema or prompt | `urls`, `prompt`, `schema` |
| `firecrawl_doctor` | Inspect health of self-hosted local Firecrawl daemon | *(none)* |

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
| `BH_AGENT_WORKSPACE` | `src/tools/browser-harness/agent-workspace` | Directory for agent-editable helpers and domain skills |
| `BH_DOMAIN_SKILLS` | `1` | Enable site-specific domain skill recipes |
| `BH_TAB_MARKER` | `1` | Enable horse emoji (`🐎`) marker on agent-managed tabs |
| `FIRECRAWL_API_URL` | `http://localhost:3002` | Local self-hosted Firecrawl API daemon endpoint |
| `FIRECRAWL_API_KEY` | *(empty)* | Optional API key (unauthenticated by default when self-hosting) |
| `FIRECRAWL_TIMEOUT` | `60.0` | Timeout in seconds for web scraping and crawls |
| `BRIDGE_LOG_FILE` | `~/Library/Logs/OpenAgent/bridge.jsonl` | Diagnostic JSONL event log path |

## Security & Safety Model

Giving an AI assistant access to your Mac requires rigorous guardrails:

* **Fail-Closed Execution**: If chat header verification fails or the target window is ambiguous, OpenAgent halts immediately.
* **Target Isolation**: OpenAgent supports operating desktop applications (including WhatsApp Desktop) with configurable target restrictions (`PROHIBITED_TARGETS`) to isolate specific processes when needed.
* **Persistent Idempotency**: Processed tool signatures are written to an append-only JSONL ledger (`processed.jsonl`) to prevent accidental replays across restarts.
* **Non-Disruptive Interaction**: Window operations and inputs target specific Process IDs (`CGEventPostToPid`) whenever possible, minimizing physical mouse hijacking.

For security reports and guidelines, read [`SECURITY.md`](SECURITY.md).

## Testing & Diagnostics

Run the comprehensive pytest suite:

```bash
uv run pytest
```

Run the macOS native adapter health check:

```bash
uv run python -c "from OpenAgent.mac_adapter import MacAdapter; print(MacAdapter().doctor())"
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
- **[Browser Use](https://github.com/browser-use/browser-use)** — Directly integrating **[Browser Harness](https://github.com/browser-use/browser-harness)** for high-speed Chrome CDP automation and domain skills, alongside **[macOS Harness](https://github.com/browser-use/macos-harness)** for pioneering native macOS computer-use foundations.
- **[whisper.cpp](https://github.com/ggerganov/whisper.cpp)** & **[Vosk](https://alphacephei.com/vosk/)** — Lightweight, local, low-latency audio intelligence.
- **[Firecrawl](https://github.com/firecrawl/firecrawl)** — Pioneering open-source web scraping, crawling, and clean LLM markdown extraction engine.

---

<div align="center">
  <sub>OpenAgent is open-source software licensed under the <a href="LICENSE">MIT License</a>.</sub>
</div>