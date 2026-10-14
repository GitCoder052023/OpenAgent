# 🏗️ Architecture & Design Philosophy — whatsapp-mcp-extended

This document describes the architectural principles, system boundaries, and extension patterns for **`whatsapp-mcp-extended`**.

---

## 🎯 Core Design Philosophy: Lean Transport Primitives

`whatsapp-mcp-extended` operates on the **Unix Philosophy**:
1. **Focus on Transport:** Provide a rock-solid, production-grade transport layer connecting AI clients (Claude Code, Cursor, OpenCode, Codex) to the WhatsApp Web protocol via `whatsmeow`.
2. **Composability:** Expose atomic, unopinionated MCP tools (`send_message`, `download_media`, `list_chats`, `manage_group`).
3. **No Heavy ML Bloat:** Machine Learning tasks (voice-to-text transcription, vector database indexing, LLM summarization) are intentionally kept out of the core transport server. Instead, agents compose tools across specialized MCP sidecars or reference plugins in `plugins/`.

---

## 🧱 System Components

```
┌────────────────────────────────────────────────────────────────────────┐
│                        AI CLIENT (Claude / Codex)                      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ FastMCP Protocol (STDIO / SSE)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      whatsapp-mcp-server (Python)                      │
│ - Exposes 26+ curated transport tools                                  │
│ - Enforces toolsets, input validation, and JSON responses              │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Local HTTP REST API (port 8080)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        whatsapp-bridge (Go)                            │
│ - Engine: whatsmeow (Go WhatsApp Web library)                          │
│ - Manages socket reconnects, QR auth, & antiban rate limits             │
│ - Stores messages in WAL-mode SQLite (`messages.db`)                   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
                          WhatsApp Web Protocol
```

---

## 🔌 Extension & Plugin Pattern

For developers who wish to add high-level processing (e.g. voice transcription or vector search):
* Reference implementation recipes are provided in [`plugins/`](plugins/).
* Plugins consume raw file outputs from `download_media` or message arrays from `list_messages` without modifying the core transport server.
* Downstream forks (such as `@simonseifert/whatsapp-mcp-pro`) provide pre-packaged all-in-one ML bundles for users who prefer monolithic installations.
