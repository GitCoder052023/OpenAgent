# Contributing to OpenAgent

Thank you for your interest in contributing to **OpenAgent**!

OpenAgent is an open-source local Mac execution and companion runtime specifically built for **Instinct**. We welcome contributions from developers, researchers, and early adopters.

## Development Prerequisites

OpenAgent interacts directly with macOS system APIs, audio subsystems, and WhatsApp Desktop. To develop on OpenAgent, you need:

* **Hardware / OS**: macOS 14 (Sonoma) or macOS 15 (Sequoia) running on Apple Silicon or Intel.
* **Python**: 3.11 or newer.
* **uv**: Astral Python package and project manager ([astral.sh/uv](https://astral.sh/uv)).
* **Bun**: Modern JavaScript/TypeScript runtime ([bun.sh](https://bun.sh)).
* **Homebrew Utilities**: `sox`, `ffmpeg`, `ripgrep`, and `whisper-cpp`.
* **Node.js & npm**: Used solely for repository-level Git hooks (Husky + Commitlint). Do not install Husky or Commitlint globally.
* **macOS Permissions**: Accessibility, Input Monitoring, Microphone, and Automation granted to your terminal application.

## Development Setup

### Automated Setup (Recommended)
Run the one-command installer to configure system utilities, uv virtual environment, Bun modules, and speech models:
```bash
git clone https://github.com/GitCoder052023/OpenAgent.git
cd OpenAgent

# 1. Autonomous setup & dependency installation
./install.py

# 2. Auto-calibrate WhatsApp Accessibility UI paths
./calibrate.py --save

# 3. Verify entire system with test suite
./test.py
```

### Manual Setup
If you prefer configuring individual components manually:
1. **Synchronize Python dependencies with uv**:
   ```bash
   uv sync --all-extras
   ```

2. **Install CLI harness dependencies with Bun**:
   ```bash
   cd src/tools/cli-harness && bun install && cd ../..
   ```

3. **Install repository Git commit hooks (Husky + Commitlint)**:
   ```bash
   npm install
   ```
   *Note: OpenAgent remains a Python/uv project. `npm install` is used exclusively for repository-level Git hooks (`husky` and `@commitlint`). Do not install Husky or Commitlint globally.*

4. **Verify local test suite**:
   ```bash
   ./test.py --unit   # Or: uv run pytest
   ```
   All tests should pass before you begin making changes.

## Architectural Invariants

When adding features or modifying existing code, you **must preserve the following core invariants**:

1. **Fail-Closed Security**: Never relax, bypass, or weaken the chat header phone number verification (`BRIDGE_SAFE_MODE`) to make a feature or test pass. If a chat is ambiguous, the bridge must halt immediately.
2. **Never Move the Physical Pointer**: In `macos-harness`, background mouse and keyboard operations must use `CGEventPostToPid` to target specific application process IDs. Synthetic inputs must never hijack the user's physical mouse cursor or steal active window focus.
3. **Configurable Target Isolation**: WhatsApp Desktop and other macOS applications can be operated via `macos-harness`. Custom target restrictions can be defined via `PROHIBITED_TARGETS` if process-level isolation is needed.
4. **Resilient Data Transport**: Always maintain compatibility with the base64 `JARVIS_CALL:<base64>:END` envelope format. Messaging platforms alter markdown, so plain JSON in chat bubbles is treated only as a fallback.
5. **No Telemetry or Data Leakage**: OpenAgent runs locally. Never add external network calls that transmit user chat messages, recordings, or execution results to third-party endpoints.

## Code Structure

* **`src/OpenAgent/` (Python)**:
  * `main.py`: CLI entrypoint, runner orchestration, hotkey hooks.
  * `replies.py`: AX message watching, background voice playback, and tool call dispatching.
  * `dispatcher.py`: Envelope decoding, tool schema normalization, and Markdown formatting.
  * `mac_adapter.py`: Adapter connecting native macOS harness primitives to the bridge.
  * `harness.py`: Stdio JSON-RPC client managing the Bun execution process.
  * `audio.py` / `voice.py`: SoX recording, silence gating, ffmpeg encoding, Whisper STT, and Vosk wake word.
  * `desktop.py` / `ax.py`: AppleScript automation, pasteboard staging, and macOS Accessibility wrappers.
* **`src/tools/cli-harness/` (Bun / TypeScript)**:
  * `harness-bridge.ts`: Stdio runner implementing `bash`, `read`, `write`, `edit`, `grep`, `glob`, and `applescript`.
* **`src/tools/browser-harness/` (Python / CDP)**:
  * Production-grade Chrome CDP engine with background tab control, Accessibility inspection, and 80+ domain skills.
* **`src/tools/macos-harness/` (Python)**:
  * Native macOS computer-use engine implementing window capture (`mac_see`), PID input targeting, and accessibility inspections.
* **`tests/` (Pytest)**:
  * Comprehensive test suite covering dispatcher parsing, concurrency, audio gating, and safe mode.

## Testing Guidelines

* **Unit Tests Required**: Any new tool, parser modification, or routing logic must be accompanied by corresponding unit tests in `tests/`.
* **Run Test Suite**:
  ```bash
  ./test.py           # Runs full test suite dashboard (unit, harness, adapters, audio)
  ./test.py --unit    # Runs only pytest unit tests
  ./test.py --harness # Runs only live Bun harness IPC test
  uv run pytest -v    # Direct pytest runner with verbose output
  ```
* **Linting & Code Quality**:
  * Python: Format and check code using standard tools (`ruff` or `flake8`).
  * JavaScript/TypeScript Linting (Oxlint):
    Fast static analysis and correctness linting is provided via **Oxlint** installed in `src/tools/locoagent/`:
    ```bash
    cd src/tools/locoagent && bun run lint
    # Or from repository root:
    bun run lint:js
    ```
    *Note: Oxlint complements TypeScript type checking (`tsc --noEmit`). No legacy ESLint was present. Vendored upstream services (`src/tools/firecrawl/`), Python workspace harnesses, build outputs, and `node_modules` are excluded from linting.*
  * TypeScript Type Checking:
    ```bash
    cd src/tools/cli-harness && bun run tsc --noEmit && cd ../..
    ```

## Pull Request Process

1. **Create a branch**: `git checkout -b feature/your-feature-name`
2. **Make your changes** following the architectural invariants above.
3. **Verify tests pass**: Run `uv run pytest`.
4. **Commit using Conventional Commits**: Write descriptive commit messages adhering to the Conventional Commits specification (e.g., `feat(voice): ...`, `fix(dispatcher): ...`, `docs(readme): ...`). Commit messages are automatically validated by the repository's Husky + Commitlint `commit-msg` hook (max header length: 150 characters, max body line length: 250 characters).
5. **Open a Pull Request**: Provide a clear explanation of your changes, how they were tested, and any relevant configuration requirements.

## Community & Conduct

All contributors and maintainers are expected to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please ensure respectful and professional interactions at all times.
