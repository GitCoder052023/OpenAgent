https://github.com/user-attachments/assets/627ceeab-4194-4f79-a7d5-c98e72197949

<div align="center">

# OpenAgent ⌘

**Say "Wake up, Jarvis." Then just talk.**<br/>
OpenAgent is the local macOS body for [Instinct AI](https://instinct.com/). It's an always-listening, hands-free assistant that operates your Mac, your browser, the web and your social accounts while you get on with your day.

[![macOS](https://img.shields.io/badge/platform-macOS%20Darwin-lightgrey.svg?style=flat-square&logo=apple)](https://apple.com)
[![Python](https://img.shields.io/badge/python-3.11%2B-blue.svg?style=flat-square&logo=python)](https://www.python.org/)
[![uv](https://img.shields.io/badge/package%20manager-uv-blueviolet.svg?style=flat-square)](https://astral.sh/uv)
[![Bun](https://img.shields.io/badge/runtime-bun-black.svg?style=flat-square&logo=bun)](https://bun.sh)
[![Tests](https://img.shields.io/badge/tests-241%20passing-brightgreen.svg?style=flat-square)]()
[![License: MIT](https://img.shields.io/badge/license-MIT-purple.svg?style=flat-square)](LICENSE)
[![Status](https://img.shields.io/badge/status-active%20beta-orange.svg?style=flat-square)]()

[Quick Start](#quick-start) · [Talking to Jarvis](#talking-to-jarvis) · [Why OpenAgent](#why-openagent) · [How It Works](#how-it-works) · [Features](#core-features) · [Tool Suite](#tool-suite) · [Configuration](#configuration) · [Docs](#documentation) · [Contributing](#contributing)

</div>

---

OpenAgent connects [Instinct AI](https://instinct.com/), a personal AI assistant that lives in your messaging apps, to your Mac and gives it a voice interface modeled on Jarvis. Start it once and say **"Wake up, Jarvis."** From then on, you speak naturally from anywhere in the room, and Instinct AI reasons over each request while OpenAgent carries it out locally: shell commands, code edits, native app control, your authenticated Chrome, self-hosted web scraping, and your social media accounts. Replies come back out loud, and screenshots & results land in your chat.

The two halves together make up a personal assistant that can act in the cloud and on your desktop.

Don't have Instinct access, or want to use your own model? [OpenHarness](https://github.com/GitCoder052023/OpenHarness) is the execution engine behind OpenAgent, available on its own. Connect Claude, Gemini, Codex, or a local Ollama model to the same Mac tools without the voice and WhatsApp setup.

```text
[ Jarvis sleeping ]

You (making coffee):  "Wake up, Jarvis."
[ Jarvis awake ]

You:       "Run the test suite on OpenAgent. If it's green, post a Threads update
            about what I shipped today."
             bash               ./test.py                              241 passed
             bash               git log --since=midnight --oneline     6 commits
             social_dedup_check threads / post                         not yet posted
             social_post        threads.net (authenticated profile)    published
Jarvis:    "All 241 tests passed. The update is live on Threads."

You (from the couch):  "Show me what it looks like."
             social_screenshot  live Chrome session                    delivered to WhatsApp
Jarvis:    "Screenshot's in your chat."

You:       "Jarvis, stand by."  →  "Confirm stand by, Jarvis."
[ Jarvis sleeping ]
```

## Talking to Jarvis

OpenAgent is built around **continuous, hands-free conversation**: the way Tony Stark talks to Jarvis while he's working, making coffee or watching TV.

- **Wake once, keep talking.** Say *"Wake up, Jarvis"* (or *"Hey Jarvis"*) and the session stays awake. Speak naturally, pause, and the request is sent after a stretch of silence.
- **Natural turn-taking.** Instinct's voice replies play automatically through your speakers. 
- **Freeform follow-ups.** The conversation lives in your Instinct chat, so context carries across turns. *"Now do the same for Reddit"* or *"Make it shorter"* works the way you'd expect.
- **Private by default.** Wake-word detection (Vosk) runs fully offline, and idle audio is never saved or sent. Nothing leaves your Mac until Jarvis is awake and you've spoken a request.
- **Push-to-talk fallback.** For quiet environments or shared spaces, hold `F8` to talk instead.

## Why OpenAgent

[Instinct](https://instinct.com/) is an invite-only personal AI assistant that works entirely through iMessage and WhatsApp. It has no app and no dashboard: you text it, send a voice note or call it. Instinct works as a chief of staff rather than a chatbot. It books appointments, manages travel, disputes bills, cancels subscriptions and reaches out on its own to follow up on deadlines. It connects to services like GitHub, Google and Notion, and it handles general computer work on virtual desktops in its own cloud.

Because that computer use happens in Instinct's cloud environment, it can reach your **accounts** but not your **machine**. OpenAgent closes that gap:

| Capability | Instinct | Instinct + OpenAgent |
| :--- | :---: | :---: |
| Always-listening, hands-free voice sessions at your desk | — | ✓ |
| Account-level tasks (email, calendar, GitHub, Notion) | ✓ | ✓ |
| Proactive reminders and follow-ups | ✓ | ✓ |
| Shell execution and code edits on your local machine | — | ✓ |
| Seeing your screen and controlling native macOS apps | — | ✓ |
| Driving your authenticated, everyday Chrome profile | — | ✓ |
| Operating WhatsApp Desktop | — | ✓ |
| Posting and engaging on Threads, Reddit, X, LinkedIn and more from your own browser sessions | — | ✓ |
| Private, self-hosted web scraping and crawling | — | ✓ |

<div align="center">
  <strong>Instinct thinks. OpenAgent acts.</strong><br/>
</div>

## How It Works

OpenAgent uses **WhatsApp Desktop as the transport** between Instinct and your Mac. You don't need an API key, a hosted backend or a custom integration.

1. **Input.** Once woken with *"Wake up, Jarvis"*, OpenAgent listens continuously to your speech until a natural pause, and then sends either a voice note or a local Whisper transcript to your Instinct chat.
2. **Tool calls.** Instinct replies with structured calls wrapped in a `JARVIS_CALL:<base64-JSON>:END` envelope. Base64 encoding protects the payload from WhatsApp's markdown formatting, which removes characters like `*`, `_` and `~`.
3. **Observation.** OpenAgent reads incoming messages through the macOS Accessibility API.
4. **Verification.** A fail-closed guard confirms the message came from the verified Instinct chat.
5. **Execution.** The dispatcher routes the call to one of five engines and runs it locally.
6. **Response.** Results, diffs and screenshots go back into the chat. Instinct continues the loop until the task is complete, and its voice replies play back automatically.

```mermaid
sequenceDiagram
    actor User
    participant OA as OpenAgent (local)
    participant WA as WhatsApp Desktop
    participant IN as Instinct (cloud)
    User->>OA: Wake word, then freeform speech
    OA->>WA: Voice note or transcript
    WA->>IN: Deliver message
    IN-->>WA: JARVIS_CALL envelope
    WA-->>OA: Read via Accessibility API
    OA->>OA: Verify chat, dedupe, dispatch, execute
    OA->>WA: Tool result / screenshot
    WA->>IN: Next turn
    IN-->>WA: Final voice reply
    WA-->>User: Automatic playback
```

## Core Features

| Engine | What it gives Instinct | Built on |
| :--- | :--- | :--- |
| **Developer Harness** | Sandboxed `bash`, paginated `read`, atomic `write`, exact-match `edit`, `ripgrep` search, `glob`, AppleScript | Bun + TypeScript |
| **Voice Interface** | Offline wake word, continuous hands-free sessions, silence-based turn-taking, echo guard, automatic reply playback | Vosk, whisper.cpp, SoX |
| **Native Computer Use** | Window capture, Accessibility tree queries, PID-targeted clicks, keystrokes, drags and scrolls that don't steal focus | macOS Accessibility & Quartz |
| **Real Browser Control** | Your authenticated Chrome: background tabs, compositor clicks through iframes and shadow DOM, framework-safe form filling, 97 site-specific domain skills | Browser Harness (CDP) |
| **Web Ingestion** | Scrape to Markdown, search with full-content results, recursive crawl, site mapping, schema-based JSON extraction | Self-hosted Firecrawl (Docker) |
| **Social Automation** | Posting, replies, likes, search and scheduled workflows on Threads and Reddit (plus X, LinkedIn, Instagram, Facebook, YouTube, TikTok, GitHub) in isolated, persistent Chrome profiles | LocoAgent (CDP) |
| **Safety Guard Engine** | Fine-grained policy evaluation (`ALLOW` / `ASK` / `DENY`), protected path globbing (SSH keys, root wipes), WhatsApp approval tokens (`CONFIRM <token>`) | `guard.py` (Rule Matrix) |
| **Experience Memory ("错题本")** | Cross-session human feedback learning, mistake capture, and derived negative rules permanently persisted to disk | `experience.py` (JSONL Ledger) |
| **macOS Daily Life Skills** | Native executive assistant skills: Reminders, iMessage, Things 3, Spotify, 1Password, Apple Notes, Camsnap, Nano-PDF, Tmux | `skills_adapter.py` (CLI Suite) |
| **Enterprise Office Suite** | Standalone Microsoft Word (`.docx`), Excel (`.xlsx`), and PowerPoint (`.pptx`) inspection, formatting, and template filling without MS Office | `office_adapter.py` (`python-docx`, `openpyxl`, `python-pptx`) |
| **Headless WhatsApp Transport** | Background WhatsApp message delivery, contact lookup, and cross-chat message search without stealing foreground window focus | `wacli_adapter.py` (`wacli`) |
| **Universal MCP Client** | Dynamic discovery and execution of any external MCP tool across Stdio subprocesses and remote SSE/StreamableHTTP endpoints | `mcp_adapter.py` (Model Context Protocol) |
| **Activity Audit Trail** | Thread-safe, non-blocking append-only JSONL event logging capturing tool names, execution duration, and security guard verdicts | `audit.py` (JSONL Audit Stream) |

**Self-healing runtime.** `boot.py` provisions its own environment, installs missing dependencies, downloads speech models, restarts the agent (and its listening session) with exponential backoff and keeps WhatsApp Desktop alive in the background. `./boot.py --doctor` runs a full preflight audit.

---

## 🚀 Enterprise Subsystems for Instinct AI

To make OpenAgent an enterprise-grade execution body for **Instinct AI** ([instinct.com](https://instinct.com)), seven battle-tested subsystems were integrated directly into the core Python architecture. This guarantees that your cloud AI chief-of-staff operates with bank-grade safety, persistent learning, and executive-level software capabilities:

### 1. Fine-Grained Safety Guard Engine (`src/OpenAgent/guard.py`)
Cloud AI models executing shell commands on your physical Mac require deterministic safety boundaries. The Guard Engine replaces crude all-or-nothing flags with a capability-based authorization matrix:
* **Three Effects:**
  * `ALLOW`: Safe, idempotent read operations run friction-free (sub-50ms).
  * `ASK`: High-impact actions generate a secure 4-character token (e.g., `B4K2`). OpenAgent pauses execution and asks on WhatsApp:
    ```text
    ⚠️ [SAFETY GUARD CONFIRMATION NEEDED]
    Instinct requested high-impact action: [bash]
    Resource: git push origin main --force
    Reason: Force-pushing git branches can overwrite remote work. Confirmation required.
    To execute, reply 'CONFIRM B4K2' (or 'CONFIRM'). To abort, reply 'CANCEL'.
    ```
    Once you reply `CONFIRM`, OpenAgent retrieves the cached pending call and executes it immediately.
  * `DENY`: Hard-coded deny rules instantly block catastrophic commands (e.g. `rm -rf /`, `rm -rf ~/*`, accessing `~/.ssh/id_*`, `/etc/shadow`).
* **Resource Matching:** Glob-pattern matching against paths, URLs, and shell commands.

### 2. Experience Memory & Mistake Notebook ("错题本") (`src/OpenAgent/experience.py`)
Instinct sessions can reset context or suffer attention drift over weeks. The Experience Engine provides persistent local learning:
* **Structured Correction Capture:** Captures `question`, `wrong_action`, `correction`, and `derived_rule`, categorized into `Fact`, `Style`, `Format`, or `Scope`.
* **Zero Repeat Errors:** Every correction is saved to `.openagent/experience/experiences.jsonl`. When Instinct starts a new task, matching rules are injected or queried via `active_rules`, ensuring your personal preferences persist permanently across machine reboots.

### 3. Native macOS Daily Life Skills Suite (`src/OpenAgent/skills_adapter.py`)
Instinct can directly manage your personal daily life through native macOS CLI integrations:
* **`apple_reminders` (`remindctl`):** *"Jarvis, remind me to call Mom at 6pm"* → instantly syncs to your iPhone Reminders.
* **`imsg` (`imsg`):** Read iMessage threads and send SMS/iMessages to contacts from the command line.
* **`things_mac` (`things`):** Query Things 3 Inbox, Today view, search projects, and create tagged todos.
* **`spotify` (`spogo`):** Control desktop music playback (*"Jarvis, play lo-fi hip hop"*, pause, skip, status).
* **`1password` (`op`):** Retrieve API tokens, logins, and credentials securely without saving plain text.
* **`peekaboo` (`peekaboo`):** Inspect macOS window hierarchies and capture specific screen regions.
* **`apple_notes` (`osascript`):** Read and generate rich formatted Apple Notes via native AppleScript.
* **`camsnap` (`camsnap`):** Capture live frames and video clips from RTSP home security cameras.
* **`nano_pdf` (`nano-pdf`):** Edit PDF pages using natural language prompts.
* **`tmux` (`tmux`):** Manage persistent background terminal sessions and capture panes.

### 4. Enterprise Office Suite Automation (`src/OpenAgent/office_adapter.py`)
Instinct acts as an executive assistant that generates and inspects Microsoft Office documents without needing Microsoft Office installed:
* **Microsoft Word (`.docx`):** `word_read` parses headings, body text, and tables; `word_write` generates polished documents with custom headings and table styling.
* **Microsoft Excel (`.xlsx`):** `excel_read` inspects workbook sheets, column headers, and data rows; `excel_write` creates styled spreadsheets with navy header fills and auto-calculated column widths.
* **Microsoft PowerPoint (`.pptx`):** `pptx_read` extracts deck hierarchy and bullet points; `pptx_write` generates complete keynote slide decks; `pptx_template_fill` replaces template placeholder tags (`{{TITLE}}`, `{{METRICS}}`) with dynamic values.

### 5. Headless WhatsApp CLI Adapter (`src/OpenAgent/wacli_adapter.py`)
While OpenAgent controls WhatsApp Desktop via Accessibility APIs for primary foreground voice chat, `wacli` provides a non-intrusive headless channel:
* Send messages and attachments silently in the background without stealing window focus.
* Search historical messages across any chat using `wacli_search`.
* List chats and contacts via `wacli_chats`.

### 6. Universal Model Context Protocol (MCP) Client (`src/OpenAgent/mcp_adapter.py`)
Instinct AI is not restricted to hardcoded tools. Through the dynamic **MCP Client**:
* Declare any MCP-compliant server (PostgreSQL, GitHub, Slack, Linear, Memory, Supabase) in `.openagent/mcp.json`.
* Supports both **Stdio** subprocesses and **StreamableHTTP / SSE** remote endpoints.
* Tools are discovered dynamically via `mcp_tools` and executed via `mcp_call`.

### 7. Non-Blocking Activity Audit Trail (`src/OpenAgent/audit.py`)
Every tool invocation, argument byte length, execution duration in milliseconds, safety guard decision, and execution status is recorded to an append-only JSON Lines stream (`.openagent/audit/audit_YYYYMMDD.jsonl`). Thread-safe, non-blocking, and perfect for real-time monitoring.

## Quick Start

### Prerequisites

* macOS 14 (Sonoma) or macOS 15 (Sequoia) on Apple Silicon or Intel
* [uv](https://astral.sh/uv) (Astral Python package and project manager)
* [Homebrew](https://brew.sh/) & [Bun](https://bun.sh/)
* Official **WhatsApp Desktop** installed and logged in

### 1. One-Command Autonomous Python Scripts

OpenAgent includes dedicated, single-command Python scripts for all lifecycle tasks:

| Script | Purpose | Common Command |
| :--- | :--- | :--- |
| **[`boot.py`](boot.py)** | **Autonomous Boot & Watchdog** | `./boot.py` (or `python3 boot.py`) |
| **[`install.py`](install.py)** | **Full Zero-Touch Installation** | `./install.py` (or `python3 install.py`) |
| **[`calibrate.py`](calibrate.py)** | **WhatsApp UI Auto-Calibration** | `./calibrate.py --save` |
| **[`test.py`](test.py)** | **Comprehensive Test Runner** | `./test.py` |

#### Quick Start:
```bash
git clone https://github.com/GitCoder052023/OpenAgent.git
cd OpenAgent

# 1. Full system installation (homebrew tools, venv, bun harness, speech models)
./install.py

# 2. Calibrate WhatsApp Desktop UI paths and labels (auto-detected)
./calibrate.py --save

# 3. Verify entire system with test suite
./test.py

# 4. Launch Jarvis with hands-free wake word enabled
./boot.py --voice --send-mode audio
```

`boot.py` is an autonomous, self-bootstrapping orchestrator and supervisor:
* **Self-Bootstrapping**: Auto-detects runtime, provisions/syncs virtual environment with `uv`, and re-execs inside `.venv` without manual activation.
* **Auto-Healing Dependencies**: Auto-resolves and installs Homebrew tools (`uv`, `bun`, `sox`, `ffmpeg`, `ripgrep`, `whisper-cpp`) and Bun harness modules.
* **Model Provisioning**: Automatically downloads offline speech models (Whisper ggml & Vosk wake models).
* **Self-Healing Supervisor Watchdog**: Supervises the agent process, re-starts OpenAgent on crashes with exponential backoff, and keeps WhatsApp Desktop backgrounded and alive.
* **Interactive Diagnostics**: Run `./boot.py --doctor` to conduct a zero-touch preflight audit of all hardware, harnesses, and permissions.

```bash
# Common launch commands:
./boot.py --voice --send-mode audio  # Recommended: hands-free wake word ("Wake up Jarvis")
./boot.py                           # Push-to-talk mode (hold F8 to speak)
./boot.py --doctor                  # Run preflight health check without starting agent
./boot.py --voice --send-mode text  # Wake-word mode with local Whisper STT transcription
./boot.py --start-firecrawl         # Auto-spinup Firecrawl Docker scraper engine
./boot.py --start-chrome            # Auto-launch Chrome with remote debugging on port 9222
./calibrate.py --dump               # Dump sanitized AX UI tree for deep debugging
./test.py --unit                    # Run only unit test suite
./test.py --harness                 # Test live Bun IPC harness
./test.py                           # Comprehensive system test runner
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
   > ⚠️ **Note for Readers:** `docs/JARVIS_INSTRUCTIONS.md` is the author's personal setup and operational file (containing his personal accounts, subreddits, and persona guidelines). You will need to edit it according to your own name, social media handles, accounts, and requirements before sending it to your agent.
2. Copy the initialization instruction prompt.
3. Paste it directly into your WhatsApp chat with Instinct.

Instinct will recognize the `JARVIS_CALL` protocol and begin executing tasks on your Mac!

## How to Operate

**Jarvis mode (recommended).** Start OpenAgent with continuous listening enabled:

```bash
./boot.py --voice --send-mode audio
```

**Push-to-talk.** Start with `./boot.py` (or `./start.sh`). Hold `F8`, speak, then release to send. Holding `F8` during a reply cuts the reply short. Press `Esc` to cancel or exit.

## Tool Suite

Instinct calls tools by wrapping structured JSON in a transport envelope:
`JARVIS_CALL:<base64-encoded-JSON>:END`.

There are 55+ tools across five engines. Expand a section for the full reference.

<details>
<summary><b>Developer Harness Tools</b> (8 tools)</summary>

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

</details>

<details>
<summary><b>Native macOS Computer-Use Tools</b> (10 tools)</summary>

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

</details>

<details>
<summary><b>Real Browser Control Tools (Browser Harness CDP)</b> (14 tools)</summary>

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

</details>

<details>
<summary><b>Self-Hosted Web Ingestion & Extraction Tools (Firecrawl Engine)</b> (7 tools)</summary>

| Tool | Description | Key Arguments |
| --- | --- | --- |
| `firecrawl_scrape` | Scrape dynamic web pages directly into clean LLM Markdown | `url`, `formats`, `only_main_content`, `wait_for` |
| `firecrawl_search` | Search the web and return full Markdown from top hits in one shot | `query`, `limit`, `scrape_options` |
| `firecrawl_crawl` | Asynchronously crawl an entire domain or documentation tree | `url`, `max_depth`, `limit` |
| `firecrawl_status` | Check the progress and page count of an ongoing crawl | `job_id` |
| `firecrawl_map` | Fast sitemap and URL discovery across a domain | `url`, `search`, `limit` |
| `firecrawl_extract` | Extract structured JSON data matching a schema or prompt | `urls`, `prompt`, `schema` |
| `firecrawl_doctor` | Inspect health of self-hosted local Firecrawl daemon | *(none)* |

</details>

<details>
<summary><b>Social Media Automation Tools (LocoAgent Engine)</b> (13 tools)</summary>

Operate real social accounts with primary focus on **Threads (`threads.net`) and Reddit (`reddit.com`)** (plus X/Twitter, LinkedIn, Instagram, Facebook, YouTube, TikTok, and GitHub) with persistent anti-detection Chrome profiles:

| Tool | Description | Key Arguments |
| --- | --- | --- |
| `social_targets` | Inspect all configured social platforms and live CDP port status | *(none)* |
| `social_setup` | Launch persistent, isolated Chrome browser for a social platform | `target`, `all`, `reset` |
| `social_post` | Publish a post or tweet with optional image/media attachment | `text`, `platform`, `media` |
| `social_reply` | Reply to a post or tweet with anti-deduplication check | `url`, `text`, `platform` |
| `social_like` | Like or react to a post with anti-deduplication check | `url`, `platform` |
| `social_search` | Search social media discussions by keyword/hashtag | `query`, `platform`, `tab` |
| `social_screenshot` | Capture live social feed screenshot delivered to WhatsApp | `platform`, `full`, `annotate` |
| `social_workflow` | Control automation pipelines (`run`, `start`, `stop`, `daemon`, `status`) | `action`, `id`, `interval` |
| `social_agent_task` | Delegate an end-to-end autonomous social media mission | `prompt`, `model`, `timeout` |
| `social_dedup_check` | Check if a URL was already interacted with in persistent ledger | `platform`, `action`, `url` |
| `social_log` | Record a successful interaction into the operation log | `platform`, `action`, `url`, `status`, `note` |
| `social_exec` | Execute direct `agent-browser` CDP command on any target | `platform`, `command` |
| `social_doctor` | Run health checks on Bun, agent-browser CLI, and Chrome CDP | *(none)* |

</details>

<details>
<summary><b>Native macOS Daily Life Skills Suite</b> (10 tools)</summary>

| Tool | Description | Key Arguments |
| --- | --- | --- |
| `apple_reminders` | Create, list, complete, and delete Apple Reminders (synced to iOS) | `action`, `title`, `due`, `list` |
| `imsg` | Read iMessage conversation threads and send SMS/iMessage from CLI | `action`, `to`, `text`, `limit` |
| `things_mac` | Query Things 3 Inbox, Today view, search tasks, and add todos | `action`, `title`, `notes`, `when` |
| `spotify` | Control Spotify music playback, search tracks, and list devices | `action`, `query` |
| `1password` | Retrieve secrets, logins, and items from 1Password via `op` | `action`, `item`, `reference` |
| `peekaboo` | Inspect macOS window hierarchies and capture screen elements | `action`, `target`, `out` |
| `apple_notes` | Create and search Apple Notes via native AppleScript | `action`, `title`, `body` |
| `camsnap` | Capture live frames and clips from RTSP/ONVIF security cameras | `action`, `camera` |
| `nano_pdf` | Edit PDF pages using natural language prompts | `action`, `path`, `prompt` |
| `skills_list` | List all 54 registered agent skills and local installation status | *(none)* |

</details>

<details>
<summary><b>Enterprise Office Suite Tools</b> (7 tools)</summary>

| Tool | Description | Key Arguments |
| --- | --- | --- |
| `word_read` | Read Word `.docx` documents with headings, paragraphs, and tables | `path`, `max_paragraphs` |
| `word_write` | Generate styled Word `.docx` documents with tables and headers | `path`, `title`, `paragraphs`, `tables` |
| `excel_read` | Inspect Excel `.xlsx` spreadsheets, sheet names, and table rows | `path`, `sheet_name`, `max_rows` |
| `excel_write` | Create or update formatted Excel `.xlsx` workbooks | `path`, `sheet_name`, `headers`, `rows` |
| `pptx_read` | Inspect PowerPoint `.pptx` decks, slide titles, and bullet points | `path`, `max_slides` |
| `pptx_write` | Generate presentation decks with title and content slides | `path`, `title`, `slides`, `subtitle` |
| `pptx_template_fill` | Fill template placeholder tags (`{{KEY}}`) in existing decks | `template_path`, `output_path`, `replacements` |

</details>

<details>
<summary><b>Headless WhatsApp, Security Guard, Experience & Universal MCP Tools</b> (10 tools)</summary>

| Tool | Description | Key Arguments |
| --- | --- | --- |
| `wacli_send` | Headless background WhatsApp message or document delivery | `to`, `message`, `file` |
| `wacli_search` | Search historical WhatsApp messages across chats without GUI | `query`, `chat`, `limit` |
| `wacli_chats` | List recent WhatsApp conversations and contacts | `query`, `limit` |
| `record_experience` | Save human corrections and learned rules ("错题本") permanently | `question`, `wrong_action`, `correction`, `rule` |
| `search_experiences`| Search learned user rules to prevent repeat mistakes | `query`, `limit` |
| `guard_rules` | Inspect active safety authorization policies and categories | *(none)* |
| `audit_events` | Tail recent tool invocations, durations, and guard verdicts | `limit` |
| `mcp_call` | Invoke any dynamic Model Context Protocol (MCP) server tool | `server`, `tool`, `arguments` |
| `mcp_tools` | List all discovered tools from active Stdio & SSE MCP servers | `server` |
| `mcp_status` | Inspect registered MCP servers and connection status | *(none)* |

</details>

> Full schema specifications, tool calling envelopes, and architecture blueprints are documented in [`COMMERCIAL_INSTINCT_INTEGRATION.md`](COMMERCIAL_INSTINCT_INTEGRATION.md) and [`docs/JARVIS_INSTRUCTIONS.md`](docs/JARVIS_INSTRUCTIONS.md).

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
| `LOCOAGENT_ENABLED` | `true` | Enable LocoAgent social automation engine |
| `LOCOAGENT_ROOT` | `src/tools/locoagent` | Directory path for LocoAgent checkout |
| `LOCOAGENT_DEFAULT_PLATFORM` | `threads` | Default social media target platform |
| `LOCOAGENT_TIMEOUT` | `120.0` | Timeout in seconds for social automation commands |
| `BRIDGE_LOG_FILE` | `~/Library/Logs/OpenAgent/bridge.jsonl` | Diagnostic JSONL event log path |

## Offline Terminal Mode (Experimental)

For private, offline terminal workflows without WhatsApp or cloud dependencies, OpenAgent includes an experimental local fallback powered by local Ollama models (`qwen2.5-coder:7b`):

```bash
./boot.py --brain openinstinct
```

> ⚠️ **Note:** OpenInstinct is in early experimental development. For architectural notes and feasibility research, see [`OPENINSTINCT_BRAIN_SPEC.md`](OPENINSTINCT_BRAIN_SPEC.md).

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

- [Setup Prompt & Tool Instructions](docs/JARVIS_INSTRUCTIONS.md) — Initialization block to connect Instinct AI. *(Note: Author's personal operational configuration — edit according to your own name, handles, and requirements.)*
- [Instinct AI Integration Specification](COMMERCIAL_INSTINCT_INTEGRATION.md) — Deep architectural specification of the 7 enterprise subsystems.
- [Offline Terminal Mode Spec (OpenInstinct)](OPENINSTINCT_BRAIN_SPEC.md) — Architectural notes and feasibility analysis for local offline models.
- [Social Media Automation Guide](docs/SOCIAL_MEDIA_AUTOMATION.md) — Architecture, platform ports, and operational guide for Threads & Reddit.
- [Accessibility & Calibration Guide](docs/CALIBRATION.md) — Deep calibration for AX trees, audio routing, and debug states.
- [Security Policy](SECURITY.md) — Security model, threat boundaries, and vulnerability reporting.
- [Contributing Guide](CONTRIBUTING.md) — Development workflow, testing, and tool additions.

---

## Contributing

Contributions are welcome. High-impact areas include:

- New macOS harness primitives and tool adapters
- Voice pipeline latency and wake-word accuracy
- Browser domain skills for additional sites
- LocoAgent workflows and platform playbooks
- Safety guards, auditing and sandboxing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the development workflow and [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) for community guidelines.

## Credits & Acknowledgments

OpenAgent is built with gratitude on the shoulders of the open-source agent tooling community:
- **[OpenCode](https://github.com/anomalyco/opencode)** — Inspiring open-source agentic coding architectures.
- **[Browser Use](https://github.com/browser-use/browser-use)** — Directly integrating **[Browser Harness](https://github.com/browser-use/browser-harness)** for high-speed Chrome CDP automation and domain skills, alongside **[macOS Harness](https://github.com/browser-use/macos-harness)** for pioneering native macOS computer-use foundations.
- **[whisper.cpp](https://github.com/ggerganov/whisper.cpp)** & **[Vosk](https://alphacephei.com/vosk/)** — Lightweight, local, low-latency audio intelligence.
- **[Firecrawl](https://github.com/firecrawl/firecrawl)** — Pioneering open-source web scraping, crawling, and clean LLM markdown extraction engine.
- **[LocoAgent](https://github.com/LocoreMind/locoagent)** — Autonomous social media agent by LocoreMind providing persistent real-browser sessions, operation deduplication, and platform playbooks.

---

<div align="center">
  <sub>OpenAgent is open-source software licensed under the <a href="LICENSE">MIT License</a>.</sub>
</div>
