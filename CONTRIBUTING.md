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
* **macOS Permissions**: Accessibility, Input Monitoring, Microphone, and Automation granted to your terminal application.

## Development Setup

1. **Fork and clone the repository**:
   ```bash
   git clone https://github.com/GitCoder052023/OpenAgent.git
   cd OpenAgent
   ```

2. **Synchronize Python dependencies with uv**:
   ```bash
   uv sync --all-extras
   ```

3. **Install CLI harness dependencies**:
   ```bash
   cd src/cli-harness
   bun install
   cd ../..
   ```

4. **Verify local test suite**:
   ```bash
   uv run pytest
   ```
   All tests should pass before you begin making changes.

## Architectural Invariants

When adding features or modifying existing code, you **must preserve the following core invariants**:

1. **Fail-Closed Security**: Never relax, bypass, or weaken the chat header phone number verification (`BRIDGE_SAFE_MODE`) to make a feature or test pass. If a chat is ambiguous, the bridge must halt immediately.
2. **Never Move the Physical Pointer**: In `macos-harness`, background mouse and keyboard operations must use `CGEventPostToPid` to target specific application process IDs. Synthetic inputs must never hijack the user's physical mouse cursor or steal active window focus.
3. **Prohibited Targets**: WhatsApp Desktop is strictly reserved for the bridge's communication channel. Never allow `macos-harness` or tool calls to target WhatsApp with synthetic UI events (`PROHIBITED_TARGETS`).
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
* **`src/cli-harness/` (Bun / TypeScript)**:
  * `harness-bridge.ts`: Stdio runner implementing `bash`, `read`, `write`, `edit`, `grep`, `glob`, and `applescript`.
* **`src/browser-harness/` (Python / CDP)**:
  * Production-grade Chrome CDP engine with background tab control, Accessibility inspection, and 80+ domain skills.
* **`src/macos-harness/` (Python)**:
  * Native macOS computer-use engine implementing window capture (`mac_see`), PID input targeting, and accessibility inspections.
* **`tests/` (Pytest)**:
  * Comprehensive test suite covering dispatcher parsing, concurrency, audio gating, and safe mode.

## Testing Guidelines

* **Unit Tests Required**: Any new tool, parser modification, or routing logic must be accompanied by corresponding unit tests in `tests/`.
* **Run Test Suite**:
  ```bash
  uv run pytest -v
  ```
* **Linting & Code Quality**:
  * Python: Format and check code using standard tools (`ruff` or `flake8`).
  * TypeScript: Check TypeScript types in `src/cli-harness/`:
    ```bash
    cd src/cli-harness && bun run tsc --noEmit && cd ../..
    ```

## Pull Request Process

1. **Create a branch**: `git checkout -b feature/your-feature-name`
2. **Make your changes** following the architectural invariants above.
3. **Verify tests pass**: Run `uv run pytest`.
4. **Commit with clear messages**: Write descriptive commit messages explaining *why* the change was made.
5. **Open a Pull Request**: Provide a clear explanation of your changes, how they were tested, and any relevant configuration requirements.

## Community & Conduct

All contributors and maintainers are expected to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please ensure respectful and professional interactions at all times.
