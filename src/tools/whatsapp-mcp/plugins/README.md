# 🔌 Plugins & Extensions Directory

`whatsapp-mcp-extended` follows a **Lean Transport Primitive** design philosophy:
* The core MCP server focuses strictly on being a high-performance, rock-solid transport layer for WhatsApp (connection management, messaging CRUD, raw media downloads, presence, webhooks, and safety allowlists).
* Specialized AI features (on-device ML transcription, vector database recall, custom LLM processors) are kept modular as reference plugins and sidecars in this directory.

---

## 📦 Available Example Plugins

1. **`transcribe_voice_notes.py`**
   - Transcribe downloaded WhatsApp audio notes using `mlx-whisper` (Apple Silicon) or `whisper`.
2. **`semantic_recall.py`**
   - Multilingual semantic vector search over chat history using `sentence-transformers`.

---

## 🛠️ How to Enable a Plugin in FastMCP

To register a plugin as an active tool on your FastMCP server, import the plugin in `main.py` or run a sidecar server:

```python
from plugins.transcribe_voice_notes import transcribe_audio

# Mount on FastMCP
@mcp.tool()
def transcribe_voice_message(file_path: str) -> dict:
    return transcribe_audio(file_path)
```
