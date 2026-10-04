# Security Policy

OpenAgent connects a conversational AI assistant (**Instinct**) to your local Mac execution environment. Because OpenAgent enables computer-use capabilities—including shell execution, filesystem modification, and GUI interactions—security and fail-closed design are paramount.

---

## Supported Versions

OpenAgent is currently in active beta. We provide security fixes for the latest version on the `main` branch:

| Version | Supported |
| :--- | :--- |
| `0.1.x` (main branch) | :white_check_mark: |
| `< 0.1.0` | :x: |

---

## Reporting a Vulnerability

If you discover a security vulnerability or design flaw in OpenAgent, **please do not report it in a public issue.**

Instead, please report vulnerabilities responsibly:
* Open a private security advisory through GitHub via **Security → Advisories → Report a vulnerability**.
* Or contact the maintainers directly via email.

Please include:
1. A description of the vulnerability and its potential impact.
2. Steps to reproduce the issue or a minimal proof-of-concept.
3. Your recommendation for remediation, if known.

We will acknowledge receipt within 48 hours and work with you to triage and address the issue before any public disclosure.

---

## Security Model & Invariants

OpenAgent implements several architectural safeguards designed to restrict execution to authorized channels:

### 1. Strict Chat Destination Lock (`BRIDGE_SAFE_MODE`)
* By default, `BRIDGE_SAFE_MODE=true` is enforced.
* Before any inbound message is read, and before any response is dispatched, OpenAgent inspects the active WhatsApp Desktop Accessibility tree (`AXUIElement`) and verifies that the selected chat header explicitly matches `BRIDGE_WHATSAPP_NUMBER`.
* If you switch to another conversation, OpenAgent halts immediately (**fail-closed**) rather than executing or dispatching into an unintended chat.

### 2. Prohibited Target Protection
* The native macOS harness maintains an explicit list of prohibited targets (`PROHIBITED_TARGETS`).
* OpenAgent strictly refuses to dispatch synthetic mouse clicks, keystrokes, or scroll events into WhatsApp Desktop itself.
* This prevents an agent from modifying the bridge's own communication channel or manipulating other chats.

### 3. Background PID Event Targeting
* Mouse and keyboard inputs dispatched by `macos-harness` are posted directly to specific application process IDs (`CGEventPostToPid`).
* Events do not move the physical mouse cursor and do not steal focus from the user's active foreground window.

### 4. Idempotency & Append-Only Ledger
* Inbound message signatures and tool call IDs are recorded in an on-disk, append-only JSONL ledger (`~/Library/Logs/OpenAgent/processed.jsonl`).
* Historical messages and previously executed tool calls will **never** re-execute across restarts, preventing replay attacks or accidental duplicate actions.

### 5. Audio Silence Gating
* Microphone recordings are evaluated against an RMS energy threshold (`gate_pcm`) prior to transmission.
* Empty clips, ambient noise, and accidental key taps are dropped before reaching the network or transcription pipeline.

---

## User Responsibilities & Operational Best Practices

When operating OpenAgent on your Mac, please observe the following security precautions:

1. **Verify Chat Contact**: Never point `BRIDGE_WHATSAPP_NUMBER` to an untrusted, unknown, or shared contact.
2. **Review Terminal Permissions**: macOS Accessibility, Microphone, and Input Monitoring permissions grant significant local control. Only grant these permissions to your trusted terminal emulator or Python virtual environment.
3. **Keep Accessibility Snapshots Local**: The `OpenAgent inspect` command dumps the raw Accessibility tree of WhatsApp Desktop, which contains private message text. **Never commit, share, or publish `ax-tree.json`.** Delete the file once calibration is complete.
4. **Shell Privileges**: Shell commands executed via the `bash` tool run with your Mac user account's privileges. Do not run OpenAgent as `root` or `sudo`.
5. **Inspect Log Files**: Log files written to `~/Library/Logs/OpenAgent/` contain execution paths, tool names, and exit codes. Review these logs before sharing them in bug reports or discussions.
