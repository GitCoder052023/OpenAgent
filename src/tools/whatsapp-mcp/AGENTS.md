# AGENTS.md — Developer & AI Agent Guidelines

Guidelines and architecture overview for AI agents and human contributors working on **whatsapp-mcp-extended**.

---

## 🎯 Architecture Overview

`whatsapp-mcp-extended` consists of three core components:

1. **`whatsapp-bridge/` (Go):** High-performance Go bridge built on `whatsmeow`. Handles WhatsApp Web socket connections, session persistence (`store/whatsapp.db`), media downloads (`/api/download`), and Webhook delivery.
2. **`whatsapp-mcp-server/` (Python):** FastMCP server exposing 26+ MCP tools to AI clients (Claude Code, Cursor, OpenCode, Codex). Communicates with the Go bridge over local HTTP. Supports optional extras:
   - `uv sync --extra transcribe` (On-device Apple Silicon voice-note transcription via `mlx-whisper`).
   - `uv sync --extra recall` (Multilingual semantic search via `sentence-transformers`).
3. **`whatsapp-web-ui/` (Next.js):** Local web dashboard for QR code scanning, session status, and message inspection.

---

## ⚠️ Critical Rules for AI Agents

1. **Security & Anti-Ban Safety:**
   * Never modify rates or payload sizes in a way that triggers WhatsApp anti-spam detection.
   * Respect JID whitelist / allowlist safety gates when enabled.

2. **Cross-Platform Compatibility:**
   * Ensure optional dependencies (`mlx-whisper`, `sentence-transformers`) use lazy imports and graceful fallback handlers (`{success: false, message: ...}`) so non-Apple-Silicon systems maintain full functionality.

3. **Database & State Safety:**
   * SQLite operations on `messages.db` and `store/whatsapp.db` must use WAL mode and proper transaction boundaries.
   * Never break LID-to-phone-JID lookup resolution (`<id>@lid` -> phone JID).

4. **Automated Downstream Monitoring:**
   * `.github/workflows/downstream-check.yml` periodically audits active satellite forks (`simonseifert`, `bitterdev`, `domdomegg`, `Coriatel`, `laudite`, `kasperpeulen`, `slarrain`) for new commits to ensure community fixes are merged upstream.

---

## 🧪 Quick Test Commands

```bash
# Run Go bridge tests
cd whatsapp-bridge && go test ./...

# Run Python MCP server tests
cd whatsapp-mcp-server && uv run pytest

# Check python formatting & linting
cd whatsapp-mcp-server && uv run ruff check .
```
