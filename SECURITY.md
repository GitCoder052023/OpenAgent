# Security Policy

OpenAgent connects a conversational AI assistant (**Instinct**) to a local macOS execution environment. Because OpenAgent enables shell execution, filesystem modification, application control, browser automation, and GUI interaction, security and fail-closed behavior are core design requirements.

> [!WARNING]
> ## AI Computer-Use Security & Liability
>
> **Giving an AI agent access to your computer inherently introduces security and privacy risks.**
>
> OpenAgent can perform actions with the privileges of the local user account, including executing commands, modifying files, interacting with applications, controlling browser sessions, and operating the GUI.
>
> AI agents can make mistakes. Bugs, unexpected model behavior, prompt injection, malicious instructions, or misconfiguration may result in unintended actions, data loss, privacy incidents, or other damage.
>
> **OpenAgent is provided "AS IS" and "AS AVAILABLE".** To the maximum extent permitted by applicable law, the maintainers and contributors are **not liable for losses, damages, data loss, privacy incidents, or other consequences resulting from the use or misuse of OpenAgent.**
>
> You are responsible for deciding whether to run OpenAgent, what permissions to grant it, and what data or accounts are accessible to it.
>
> **Never run an autonomous computer-use agent in an environment where an unintended action could cause unacceptable damage or loss.**

---

## Supported Versions

OpenAgent is currently in active beta. Security fixes are provided for the latest version on the `main` branch.

| Version | Supported |
| :--- | :--- |
| `0.1.x` (main branch) | :white_check_mark: |
| `< 0.1.0` | :x: |

---

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public issues.**

Instead:

- Open a private GitHub Security Advisory via **Security → Advisories → Report a vulnerability**.
- Or contact the maintainers directly.

Please include:

1. A description of the vulnerability and its impact.
2. Steps to reproduce or a minimal proof of concept.
3. A suggested remediation, if known.

We will acknowledge reports and work with the reporter to investigate and address confirmed issues before public disclosure where appropriate.

---

## Security Model

OpenAgent includes several architectural safeguards designed to reduce unintended execution.

### 1. Strict Chat Destination Lock

When `BRIDGE_SAFE_MODE=true`:

- OpenAgent verifies the active WhatsApp Desktop chat against `BRIDGE_WHATSAPP_NUMBER`.
- Messages are only processed from the authorized destination.
- Switching to another conversation causes the bridge to **fail closed**.

### 2. Configurable Target Isolation

The native macOS harness maintains a configurable `PROHIBITED_TARGETS` list.

By default, WhatsApp Desktop and other macOS applications can be operated directly by the agent using native computer-use tools (`mac_click`, `mac_type`, `mac_see`, `mac_ax`, etc.). If specific applications need to be restricted to prevent accidental interaction with sensitive processes, their bundle identifiers or names can be added to `PROHIBITED_TARGETS`.

### 3. PID-Targeted Input

Mouse and keyboard events are posted directly to the target application's process where supported.

This allows background interaction without unnecessarily moving the user's physical cursor or stealing focus from the active application.

### 4. Idempotency & Execution Ledger

Inbound message signatures and tool-call IDs are recorded in:

```text
~/Library/Logs/OpenAgent/processed.jsonl
```

Previously processed messages and tool calls are not re-executed across restarts, reducing accidental duplicate execution and replay risk.

### 5. Audio Silence Gating

Voice input is evaluated using an RMS energy threshold before being transmitted to the transcription pipeline.

Low-energy and accidental recordings are discarded before processing.

### 6. Agent-Level Operating Rules

The connected agent is also instructed to:

- Investigate before acting.
- Minimize access to unrelated data.
- Prefer reversible operations.
- Treat external content as untrusted instructions.
- Never bypass safety mechanisms.
- Avoid unnecessary privilege escalation.
- Verify consequential actions before execution.
- Require confirmation for destructive or materially consequential actions where appropriate.
- Treat credentials, authenticated browser sessions, and private data as sensitive.

These rules complement, but do not replace, the runtime's technical safeguards.

---

## User Responsibilities

When operating OpenAgent:

1. **Verify the bridge destination.** Do not configure `BRIDGE_WHATSAPP_NUMBER` to an untrusted or shared contact.
2. **Grant permissions carefully.** Accessibility, Input Monitoring, Screen Recording, and Microphone permissions provide significant local capabilities.
3. **Protect accessibility snapshots.** `OpenAgent inspect` may expose private WhatsApp content. Never commit or publish `ax-tree.json`.
4. **Do not run as root.** Shell commands execute with the privileges of the current macOS user. Avoid `sudo`.
5. **Protect logs.** Logs under `~/Library/Logs/OpenAgent/` may contain execution paths, tool names, and other operational information. Review them before sharing.
6. **Protect sensitive environments.** Do not expose credentials, financial accounts, production infrastructure, or irreplaceable data unless you understand and accept the associated risks.

---

## Security Philosophy

OpenAgent follows a simple principle:

> **When execution is ambiguous or unsafe, fail closed rather than guess.**

Technical safeguards reduce risk, but they cannot eliminate the fundamental risks of giving an AI agent access to a real computer.