<img src="https://raw.githubusercontent.com/browser-use/macos-harness/main/static/banner-ink.svg" alt="macOS Harness" width="100%" />

# OpenAgent

> **The local macOS computer-use runtime for Instinct.**

[![macOS](https://img.shields.io/badge/macOS-000000?logo=apple&logoColor=white)](https://www.apple.com/macos/)
[![Python](https://img.shields.io/badge/Python-3.11%2B-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![Bun](https://img.shields.io/badge/Bun-runtime-black?logo=bun&logoColor=white)](https://bun.sh/)
[![Tests](https://img.shields.io/badge/tests-125%20passing-brightgreen)](#testing)
[![Status](https://img.shields.io/badge/status-active%20beta-orange)](#status)
[![License](https://img.shields.io/badge/license-MIT-blue)](#license)

OpenAgent is the **local execution runtime** that gives [Instinct](#what-is-instinct) the ability to interact with a real macOS computer.

It connects an AI assistant to the operating system through a combination of native macOS APIs, browser automation, shell execution, filesystem operations, accessibility APIs, keyboard and mouse control, and voice interaction.

OpenAgent is designed to run **locally on the user's Mac** rather than operating as a remote browser-only automation service.

## Index

- [What is OpenAgent?](#what-is-openagent)
- [What is Instinct?](#what-is-instinct)
- [Core Architecture](#core-architecture)
- [Capabilities](#capabilities)
- [Example](#example)
- [How It Works](#how-it-works)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [One-Time Instinct Setup](#one-time-instinct-setup)
- [Security](#security)
- [Testing](#testing)
- [Status](#status)
- [Contributing](#contributing)
- [License](#license)
- [Credits](#credits)

## What is OpenAgent?

OpenAgent is the **computer-use layer** of Instinct.

An AI assistant can reason about what should happen, but reasoning alone does not give it access to the user's computer.

OpenAgent provides that missing execution layer.

```text
┌───────────────────────────┐
│         INSTINCT          │
│                           │
│  Reasoning / Planning     │
│  Conversation / Memory    │
│  Agent Intelligence       │
└─────────────┬─────────────┘
              │
              │ Structured tool calls
              ▼
┌───────────────────────────┐
│        OPENAGENT          │
│                           │
│  Tool Execution            │
│  Computer Use              │
│  Shell / Files             │
│  Browser Automation        │
│  Voice Pipeline            │
│  Safety Controls            │
└─────────────┬─────────────┘
              │
              ▼
┌───────────────────────────┐
│           macOS           │
│                           │
│  Apps / Windows / Files   │
│  Browser / Keyboard       │
│  Mouse / Accessibility    │
└───────────────────────────┘
```

The separation is intentional:

> **Instinct decides what to do. OpenAgent makes it happen.**

## What is Instinct?

[Instinct](#) is a free, invite-only personal AI assistant designed to communicate with users through interfaces such as text messaging and WhatsApp.

OpenAgent is the local runtime that allows Instinct to go beyond conversation and **operate the user's Mac**.

This means an Instinct agent can potentially:

- inspect the current screen
- interact with applications
- open and control browser pages
- type text
- press keyboard shortcuts
- move and click the mouse
- read accessibility information
- execute shell commands
- read and modify files
- interact with local development environments
- receive voice input
- interact with WhatsApp Desktop
- perform multi-step computer workflows

## Core Architecture

OpenAgent is split into several layers rather than being one large automation process.

```text
                         INSTINCT
                            │
                            │
                    Agent / Tool Calls
                            │
                            ▼
                    ┌───────────────┐
                    │     Bridge    │
                    │               │
                    │ Communication │
                    │    Protocol   │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │    Harness    │
                    │               │
                    │ Tool Routing  │
                    │   Execution   │
                    │    Runtime    │
                    └───────┬───────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
              ▼             ▼             ▼
        Shell / Files   Browser      Voice
              │         Automation      │
              │             │             │
              └─────────────┼─────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ macOS Harness │
                    │               │
                    │ Accessibility │
                    │ Mouse / Keys  │
                    │ Windows / Apps│
                    └───────┬───────┘
                            │
                            ▼
                           macOS
```

### The important distinction

OpenAgent does not attempt to make the AI itself responsible for low-level computer interaction.

Instead:

```text
AI reasoning
     ↓
structured tool call
     ↓
OpenAgent
     ↓
native macOS / browser / shell APIs
     ↓
real-world action
```

This makes the execution layer independently testable, inspectable, and replaceable.

## Capabilities

OpenAgent currently provides several categories of computer interaction.

### Computer Use

Native macOS interaction through the local computer-use runtime:

- Screen observation
- Mouse movement
- Mouse clicking
- Mouse dragging
- Keyboard input
- Keyboard shortcuts
- Scrolling
- Application discovery
- Window discovery
- Accessibility-tree inspection

Available tools include:

```text
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
```

### Browser Automation

Browser interaction through Chrome's debugging interface and automation layer.

OpenAgent can work with:

- browser tabs
- pages
- navigation
- DOM-backed interactions
- browser state
- page inspection

Tooling includes:

```text
mac_browser
```

### Shell & Development Tools

OpenAgent can operate the local development environment through tools such as:

```text
bash
read
write
edit
grep
glob
applescript
system_info
```

This enables an agent to work with:

- source code
- configuration files
- project directories
- command-line applications
- local scripts
- development environments

### Voice Interaction

OpenAgent includes a local voice pipeline supporting:

- Push-to-talk
- Local speech transcription
- Voice activity handling
- Barge-in
- Wake-word detection
- Audio gating

The default push-to-talk key is:

```text
F8
```

The voice pipeline can use local speech-processing components such as Whisper and Vosk.

### WhatsApp Desktop

OpenAgent can interact with WhatsApp Desktop through macOS accessibility mechanisms.

This allows Instinct to use the desktop application as an additional communication surface.

## Example

A simplified interaction can look like this:

```text
User
 │
 │ "Open my project and run the tests."
 ▼
Instinct
 │
 │ Plans the task
 ▼
OpenAgent
 │
 ├── opens project
 ├── executes command
 ├── reads output
 └── reports result
 │
 ▼
Instinct
 │
 │ Responds to user
 ▼
User
```

The AI handles the **reasoning**.

OpenAgent handles the **execution**.

## How It Works

At a high level, an action flows through the runtime like this:

```text
1. Instinct decides on an action
              │
              ▼
2. Instinct emits a structured tool call
              │
              ▼
3. OpenAgent receives the request
              │
              ▼
4. Harness validates and routes the tool
              │
              ▼
5. Native / browser / shell subsystem executes it
              │
              ▼
6. Result is returned to Instinct
              │
              ▼
7. Instinct continues reasoning
```

For communication between components, OpenAgent also supports the:

```text
JARVIS_CALL:<base64-encoded JSON>:END
```

protocol.

Detailed protocol documentation belongs in:

- [`docs/tools.md`](docs/tools.md)
- [`docs/architecture.md`](docs/architecture.md)

## Project Structure

The repository is organized around the runtime layers:

```text
OpenAgent/
├── bridge/
│   └── Communication between Instinct and OpenAgent
│
├── harness/
│   └── Headless Bun / TypeScript execution runtime
│
├── macos-harness/
│   └── Native macOS computer-use implementation
│
├── voice/
│   └── Local voice processing and transcription
│
├── tests/
│   └── Automated test suite
│
├── docs/
│   ├── architecture.md
│   ├── setup.md
│   ├── calibration.md
│   ├── tools.md
│   ├── configuration.md
│   ├── security.md
│   └── development.md
│
└── README.md
```

The README intentionally stays focused on **what OpenAgent is and how to get started**.

Detailed implementation documentation lives under `docs/`.

# Quick Start

> OpenAgent currently targets **macOS** and is in active beta development.

### Requirements

- macOS
- Python 3.11+
- Bun
- Accessibility permissions
- Screen Recording permissions
- A working Instinct installation

Clone the repository:

```bash
git clone https://github.com/GitCoder052023/OpenAgent.git
cd OpenAgent
```

Install dependencies:

```bash
bun install
```

Set up the Python environment:

```bash
python3.11 -m venv .venv
source .venv/bin/activate
```

Install Python dependencies:

```bash
pip install -r requirements.txt
```

Then configure the required macOS permissions and environment variables.

See:

```text
docs/setup.md
```

for the complete setup process.

---

## One-Time Instinct Setup

OpenAgent is designed to work as the local execution runtime for Instinct.

Once OpenAgent is installed and configured, connect it to your Instinct instance using the bridge configuration.

The exact configuration depends on the Instinct deployment and communication setup.

See:

```text
docs/setup.md
```

for the complete integration procedure.

---

## Security

Computer-use software has access to extremely powerful capabilities.

OpenAgent can potentially:

- execute shell commands
- access files
- control applications
- interact with browsers
- control keyboard and mouse input
- access accessibility information

Therefore, OpenAgent treats execution safety as a core part of the runtime.

Current safety mechanisms include:

- strict chat locking
- target isolation
- PID-targeted input
- append-only deduplication ledger
- controlled tool routing
- explicit local execution
- separation between reasoning and execution

### Important

> **Do not run OpenAgent with permissions you are not comfortable giving to an autonomous computer-use system.**

Only connect it to environments where you understand the possible consequences of automated actions.

For the complete security model and threat considerations, see:

```text
docs/security.md
```

## Testing

OpenAgent includes an automated test suite covering the runtime and its core functionality.

Run the test suite with:

```bash
bun test
```

For development diagnostics and deeper test instructions:

```text
docs/development.md
```

Current project status:

```text
125 tests passing
```

## Status

OpenAgent is currently in **active beta**.

The project is functional and actively evolving, but APIs, tool interfaces, architecture, and configuration may change as the runtime develops.

Expect breaking changes during this phase.

The goal is to eventually provide a stable, modular, open-source computer-use runtime that can be used as the local execution layer for AI agents.

## Contributing

Contributions are welcome.

You can contribute through:

- bug reports
- feature requests
- documentation
- tests
- macOS automation improvements
- accessibility improvements
- browser automation
- voice pipeline improvements
- performance improvements
- security reviews
- new tools
- architecture improvements

Before making a large change, open an issue or discussion so the direction can be aligned first.

### Development

Clone the repository:

```bash
git clone https://github.com/GitCoder052023/OpenAgent.git
cd OpenAgent
```

Install dependencies:

```bash
bun install
```

Run tests:

```bash
bun test
```

For development architecture and contribution details:

```text
docs/development.md
```

## License

OpenAgent is released under the **MIT License**.

See [`LICENSE`](LICENSE) for the complete license text.

## Credits

OpenAgent builds on the work of the open-source community.

In particular, parts of the native macOS computer-use implementation are based on and directly incorporate code from the **Browser Use macOS Harness** project.

We are grateful to the maintainers and contributors of the upstream project for making their work available under an open-source license.

If you are using or redistributing OpenAgent, please preserve the applicable upstream copyright and license notices.

Additional third-party dependencies and their licenses are documented in the repository where applicable.

<div align="center">

**OpenAgent**

*Instinct thinks. OpenAgent acts.*

</div>