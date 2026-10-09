"""OpenInstinct Brain Engine for OpenAgent.

Provides an autonomous, local, text-based terminal chief-of-staff experience
modeled after commercial Instinct, OpenCode, and Claude Code:
1. Powered by local Ollama (default: qwen2.5-coder:7b) with zero external cloud dependencies.
2. Direct execution of all 5 local OpenAgent engines:
   - cli-harness (sandboxed bash, atomic writes, exact edits, ripgrep, glob, applescript)
   - macos-harness (native screen capture, click, type, key, AX inspection)
   - browser-harness (real authenticated Chrome via CDP)
   - firecrawl (local web scraping & crawling)
   - locoagent (social automation)
3. 3-Tier Long-Term Memory (Profile facts, Workstreams project tracker, local state).
4. Signature Instinct Tone: Sharp, decisive, casual lowercase, never sycophantic or padded.
"""

import atexit
import datetime
import json
import logging
import os
import readline
import shutil
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from .config import Config
from .dispatcher import execute_tool_call, format_tool_response, parse_tool_calls
from .harness import Harness

try:
    from .mac_adapter import MacAdapter
except ImportError:
    MacAdapter = None  # type: ignore

try:
    from .browser_adapter import BrowserAdapter
except ImportError:
    BrowserAdapter = None  # type: ignore

try:
    from .firecrawl_adapter import FirecrawlAdapter
except ImportError:
    FirecrawlAdapter = None  # type: ignore

try:
    from .loco_adapter import LocoAdapter
except ImportError:
    LocoAdapter = None  # type: ignore


logger = logging.getLogger("openagent.openinstinct")

# ANSI Terminal Colors
class Colors:
    RESET = "\033[0m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    ITALIC = "\033[3m"
    UNDERLINE = "\033[4m"
    
    # Foreground
    BLACK = "\033[30m"
    RED = "\033[31m"
    GREEN = "\033[32m"
    YELLOW = "\033[33m"
    BLUE = "\033[34m"
    MAGENTA = "\033[35m"
    CYAN = "\033[36m"
    WHITE = "\033[37m"
    
    # Bright
    BRIGHT_BLACK = "\033[90m"
    BRIGHT_RED = "\033[91m"
    BRIGHT_GREEN = "\033[92m"
    BRIGHT_YELLOW = "\033[93m"
    BRIGHT_BLUE = "\033[94m"
    BRIGHT_MAGENTA = "\033[95m"
    BRIGHT_CYAN = "\033[96m"
    BRIGHT_WHITE = "\033[97m"


# ---------------------------------------------------------------------------
# Persistent 3-Tier Memory Engine (Profile + Workstreams)
# ---------------------------------------------------------------------------

class MemoryStore:
    """Manages cross-session user profile and active workstream state."""

    def __init__(self, storage_path: Optional[Path] = None):
        if storage_path is None:
            home = Path.home() / ".openagent"
            home.mkdir(parents=True, exist_ok=True)
            self.path = home / "openinstinct_memory.json"
        else:
            self.path = storage_path
            self.path.parent.mkdir(parents=True, exist_ok=True)

        self.profile: Dict[str, Any] = {
            "name": os.getenv("USER", "Hamdan"),
            "os": "macOS Darwin (Apple Silicon)",
            "editor": "VSCode",
            "shell": os.getenv("SHELL", "/bin/zsh"),
            "preferences": [
                "Prefer concise, direct answers with immediate action",
                "Use local terminal tools and Chrome whenever applicable",
                "Keep working tree clean and verify changes before reporting",
            ]
        }
        self.workstreams: List[Dict[str, Any]] = []
        self.load()

    def load(self):
        if self.path.exists():
            try:
                with open(self.path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self.profile = data.get("profile", self.profile)
                    self.workstreams = data.get("workstreams", self.workstreams)
            except Exception as exc:
                logger.warning("Could not read memory from %s: %s", self.path, exc)

    def save(self):
        try:
            with open(self.path, "w", encoding="utf-8") as f:
                json.dump({
                    "profile": self.profile,
                    "workstreams": self.workstreams,
                    "updated_at": datetime.datetime.now().isoformat()
                }, f, indent=2)
        except Exception as exc:
            logger.warning("Could not save memory to %s: %s", self.path, exc)

    def save_workstream(self, goal: str, status: str = "active", decision: Optional[str] = None, next_step: Optional[str] = None) -> str:
        # Check if existing workstream matches goal
        for ws in self.workstreams:
            if ws.get("goal", "").lower() == goal.lower() or goal.lower() in ws.get("goal", "").lower():
                ws["status"] = status
                if decision:
                    decisions = ws.setdefault("decisions", [])
                    if decision not in decisions:
                        decisions.append(decision)
                if next_step:
                    ws["next_step"] = next_step
                ws["updated_at"] = datetime.datetime.now().isoformat()
                self.save()
                return f"Updated existing workstream: '{ws['goal']}' [{status}]"

        # Add new workstream
        ws_id = f"ws-{len(self.workstreams) + 1}"
        new_ws = {
            "id": ws_id,
            "goal": goal,
            "status": status,
            "decisions": [decision] if decision else [],
            "next_step": next_step or "",
            "created_at": datetime.datetime.now().isoformat(),
            "updated_at": datetime.datetime.now().isoformat(),
        }
        self.workstreams.append(new_ws)
        self.save()
        return f"Created workstream '{goal}' [{status}]"

    def list_workstreams(self, active_only: bool = True) -> List[Dict[str, Any]]:
        if active_only:
            return [ws for ws in self.workstreams if ws.get("status") == "active"]
        return self.workstreams

    def save_profile_fact(self, key: str, value: Any) -> str:
        self.profile[key] = value
        self.save()
        return f"Saved profile fact: {key} = {value}"

    def get_prompt_context(self) -> str:
        lines = []
        lines.append("=== USER PROFILE ===")
        lines.append(f"Name: {self.profile.get('name', 'User')}")
        lines.append(f"OS: {self.profile.get('os', 'macOS')}")
        prefs = self.profile.get("preferences", [])
        if prefs:
            lines.append("Preferences:")
            for p in prefs:
                lines.append(f" - {p}")

        active_ws = self.list_workstreams(active_only=True)
        if active_ws:
            lines.append("\n=== ACTIVE WORKSTREAMS ===")
            for ws in active_ws[-5:]:  # Most recent 5
                decisions_str = f" | Decisions: {', '.join(ws.get('decisions', []))}" if ws.get("decisions") else ""
                next_str = f" | Next: {ws.get('next_step')}" if ws.get("next_step") else ""
                lines.append(f"• [{ws.get('id', 'ws')}] {ws.get('goal', 'Task')} ({ws.get('status')}){decisions_str}{next_str}")
        return "\n".join(lines)


# ---------------------------------------------------------------------------
# Tool Declarations (Clean Schema for Ollama & Local LLMs)
# ---------------------------------------------------------------------------

OPENINSTINCT_TOOLS: List[Dict[str, Any]] = [
    # 1. CLI Harness (OpenCode / Bun)
    {
        "type": "function",
        "function": {
            "name": "bash",
            "description": "Execute shell commands directly on the local Mac with output capture and timeout.",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {"type": "string", "description": "The exact bash command to execute."},
                    "cwd": {"type": "string", "description": "Working directory path (defaults to repo root)."},
                    "timeout_ms": {"type": "integer", "description": "Execution timeout in milliseconds (default: 60000)."}
                },
                "required": ["command"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "read",
            "description": "Read file contents (with optional pagination) or list directory contents.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "File or directory path to inspect."},
                    "offset": {"type": "integer", "description": "Line offset to start reading from (1-indexed)."},
                    "limit": {"type": "integer", "description": "Number of lines to read."}
                },
                "required": ["path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "write",
            "description": "Atomically write or overwrite content to a file on the local machine.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Target file path."},
                    "content": {"type": "string", "description": "Full text content to write."}
                },
                "required": ["path", "content"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "edit",
            "description": "Perform an exact chunk search-and-replace edit on a file with unified diff output.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "File path to modify."},
                    "target": {"type": "string", "description": "Exact text chunk to find and replace."},
                    "replacement": {"type": "string", "description": "Replacement text chunk."}
                },
                "required": ["path", "target", "replacement"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "grep",
            "description": "Perform high-speed ripgrep pattern searches across code and files.",
            "parameters": {
                "type": "object",
                "properties": {
                    "pattern": {"type": "string", "description": "Regex or string pattern to search for."},
                    "path": {"type": "string", "description": "Directory or file to search within (default: .)."},
                    "glob": {"type": "string", "description": "Optional glob filter (e.g. *.py, *.ts)."}
                },
                "required": ["pattern"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "glob",
            "description": "Find files matching a glob pattern.",
            "parameters": {
                "type": "object",
                "properties": {
                    "pattern": {"type": "string", "description": "Glob pattern (e.g. **/*.tsx)."},
                    "path": {"type": "string", "description": "Starting directory (default: .)."}
                },
                "required": ["pattern"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "applescript",
            "description": "Execute native AppleScript code to control macOS applications, system settings, or UI.",
            "parameters": {
                "type": "object",
                "properties": {
                    "script": {"type": "string", "description": "The AppleScript code to execute."}
                },
                "required": ["script"]
            }
        }
    },

    # 2. Native macOS Harness (Computer Use & AX)
    {
        "type": "function",
        "function": {
            "name": "mac_see",
            "description": "Inspect window state, app layout, and accessibility hierarchy without taking focus.",
            "parameters": {
                "type": "object",
                "properties": {
                    "app": {"type": "string", "description": "Name of app to inspect (e.g. Spotify, Chrome, Finder)."},
                    "include_summary": {"type": "boolean", "description": "Include structured text summary of active elements."}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "mac_click",
            "description": "Click mouse at specific screen coordinates or inside a native macOS app window.",
            "parameters": {
                "type": "object",
                "properties": {
                    "x": {"type": "number", "description": "X coordinate."},
                    "y": {"type": "number", "description": "Y coordinate."},
                    "app": {"type": "string", "description": "Target app name (optional)."},
                    "button": {"type": "string", "enum": ["left", "right"], "description": "Mouse button (default: left)."},
                    "click_count": {"type": "integer", "description": "Number of clicks (1 for single, 2 for double)."}
                },
                "required": ["x", "y"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "mac_type",
            "description": "Type text into the target Mac application window without stealing focus.",
            "parameters": {
                "type": "object",
                "properties": {
                    "text": {"type": "string", "description": "Text to type."},
                    "app": {"type": "string", "description": "Target app name (optional)."}
                },
                "required": ["text"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "mac_key",
            "description": "Send a keyboard key or hotkey combination (e.g. 'cmd+k', 'return', 'tab', 'escape').",
            "parameters": {
                "type": "object",
                "properties": {
                    "key": {"type": "string", "description": "Key or hotkey combo to press."},
                    "app": {"type": "string", "description": "Target app name (optional)."}
                },
                "required": ["key"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "mac_apps",
            "description": "List all active, running graphical applications on macOS.",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "mac_ax",
            "description": "Query or interact with the native macOS Accessibility (AX) tree for UI elements.",
            "parameters": {
                "type": "object",
                "properties": {
                    "action": {"type": "string", "enum": ["query", "press", "set_value"], "description": "Action to perform."},
                    "app": {"type": "string", "description": "Application name."},
                    "text": {"type": "string", "description": "Text or label to search for in UI elements."}
                },
                "required": ["action"]
            }
        }
    },

    # 3. Real Browser Harness (Authenticated Chrome CDP)
    {
        "type": "function",
        "function": {
            "name": "browser_open",
            "description": "Open a URL in the user's real, authenticated Google Chrome browser via CDP.",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "The URL to navigate to."},
                    "new_tab": {"type": "boolean", "description": "Open in a new background tab (default: false)."}
                },
                "required": ["url"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "browser_info",
            "description": "Get current page URL, title, and DOM structure of the active Chrome tab.",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "browser_click",
            "description": "Click an element on the active Chrome page by CSS selector or coordinates.",
            "parameters": {
                "type": "object",
                "properties": {
                    "selector": {"type": "string", "description": "CSS selector to click."},
                    "x": {"type": "number", "description": "X coordinate (optional)."},
                    "y": {"type": "number", "description": "Y coordinate (optional)."}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "browser_fill",
            "description": "Fill an input field on the active Chrome page.",
            "parameters": {
                "type": "object",
                "properties": {
                    "selector": {"type": "string", "description": "CSS selector of input field."},
                    "value": {"type": "string", "description": "Text value to fill."}
                },
                "required": ["selector", "value"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "browser_tabs",
            "description": "List all open tabs in Google Chrome.",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    },

    # 4. Firecrawl Web Ingestion
    {
        "type": "function",
        "function": {
            "name": "firecrawl_scrape",
            "description": "Scrape any public webpage into clean, readable Markdown via self-hosted Firecrawl.",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {"type": "string", "description": "The webpage URL to scrape."}
                },
                "required": ["url"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "firecrawl_search",
            "description": "Perform web search with full content extraction.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query."}
                },
                "required": ["query"]
            }
        }
    },

    # 5. Social Media Automation (LocoAgent)
    {
        "type": "function",
        "function": {
            "name": "social_post",
            "description": "Post content to Threads, Reddit, X, or LinkedIn from your authenticated profiles.",
            "parameters": {
                "type": "object",
                "properties": {
                    "platform": {"type": "string", "enum": ["threads", "reddit", "x", "linkedin"], "description": "Platform to post to."},
                    "text": {"type": "string", "description": "Post content text."},
                    "title": {"type": "string", "description": "Title (required for Reddit)."},
                    "subreddit": {"type": "string", "description": "Subreddit name (for Reddit)."}
                },
                "required": ["platform", "text"]
            }
        }
    },

    # 6. Memory & Workstream Tracking (OpenInstinct Brain State)
    {
        "type": "function",
        "function": {
            "name": "workstream_save",
            "description": "Save or update an ongoing project goal, decision, or next step in persistent memory.",
            "parameters": {
                "type": "object",
                "properties": {
                    "goal": {"type": "string", "description": "The project goal or undertaking title."},
                    "status": {"type": "string", "enum": ["active", "completed", "paused"], "description": "Status of workstream."},
                    "decision": {"type": "string", "description": "Important architectural decision or constraint decided."},
                    "next_step": {"type": "string", "description": "Next unresolved step to be completed."}
                },
                "required": ["goal"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "profile_save",
            "description": "Save a stable fact or preference about the user into long-term profile memory.",
            "parameters": {
                "type": "object",
                "properties": {
                    "key": {"type": "string", "description": "Fact label (e.g. 'preferred_package_manager')."},
                    "value": {"type": "string", "description": "Fact value (e.g. 'uv')."}
                },
                "required": ["key", "value"]
            }
        }
    }
]


# ---------------------------------------------------------------------------
# OpenInstinct Persona & System Prompt
# ---------------------------------------------------------------------------

def build_system_prompt(memory: MemoryStore, project_root: Path) -> str:
    now_str = datetime.datetime.now().strftime("%A, %B %d, %Y at %I:%M %p")
    memory_context = memory.get_prompt_context()

    prompt = f"""# Identity & Purpose
You are OpenInstinct, the root autonomous coordinator and personal chief of staff for the user's Mac.
You are the direct open-source brain of OpenAgent, operating their machine, local shell, files, real Chrome browser, web scraping, and social accounts.

# Voice & Tone Guidelines (Strict Instinct Behavioral Contract):
- Sound like a sharp, capable friend, not customer support. Be specific, decisive, and lightly funny when it lands. Never be padded.
- Default to casual lowercase in conversational prose. Preserve normal capitalization when exact names, titles, symbols, or code identifiers require it.
- NEVER use sycophantic corporate AI fluff (BANNED: "Certainly!", "I'd be happy to help", "Great question!", "Sure!").
- Do not hedge behind long balanced lists when asked for a recommendation: make the call directly.
- Keep conversational replies concise: 1 to 4 compact lines. Lead with the direct result or answer.
- Do not narrate your methodology ("I will now run git status..."). Call the tool directly and present the verified outcome.
- Never use the "not just X, but Y" cliché or em-dashes as cadence punctuation.

# Operational Execution Style:
- Lead with execution. Work autonomously on routine, reversible steps. Ask only for information or approval that materially blocks progress.
- You have complete control over the local Mac:
  • Shell & Files: Use `bash`, `read`, `write`, `edit`, `grep`, `glob`.
  • Native macOS UI: Use `mac_see`, `mac_click`, `mac_type`, `mac_key`, `mac_ax`, `mac_apps`.
  • Authenticated Chrome: Use `browser_open`, `browser_click`, `browser_fill`, `browser_info`, `browser_tabs`.
  • Web Scraping: Use `firecrawl_scrape`, `firecrawl_search`.
  • Social Accounts: Use `social_post`.
  • Memory & State: Use `workstream_save` and `profile_save`.
- Always verify your work before concluding. Check exit codes and error output.

{memory_context}

System Context:
- Current Date/Time: {now_str}
- Working Directory: {project_root}
- Platform: macOS Darwin (Apple Silicon)
"""
    return prompt.strip()


# ---------------------------------------------------------------------------
# Ollama Client & Multi-Turn Tool Loop
# ---------------------------------------------------------------------------

class OllamaClient:
    """Zero-dependency HTTP client for local Ollama."""

    def __init__(self, base_url: str = "http://localhost:11434", model: str = "qwen2.5-coder:7b", temperature: float = 0.2):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.temperature = temperature

    def check_health(self) -> Tuple[bool, str]:
        """Verifies Ollama is running and the target model is loaded or available."""
        url = f"{self.base_url}/api/tags"
        try:
            req = urllib.request.Request(url, method="GET")
            with urllib.request.urlopen(req, timeout=3.0) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                models = [m.get("name", "") for m in data.get("models", [])]
                # Check model matching (e.g. qwen2.5-coder:7b or qwen2.5-coder:latest)
                prefix = self.model.split(":")[0]
                matched = any(self.model in m or m.startswith(prefix) for m in models)
                if matched:
                    return True, f"Ollama online (found model: {self.model})"
                return False, f"Ollama online, but model '{self.model}' not found in installed models: {models}"
        except Exception as exc:
            return False, f"Ollama connection refused at {self.base_url} ({exc})"

    def chat(self, messages: List[Dict[str, Any]], tools: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        """Send a turn to Ollama and return the assistant response message."""
        url = f"{self.base_url}/api/chat"
        payload: Dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": self.temperature,
                "num_ctx": 16384,
            }
        }
        if tools:
            payload["tools"] = tools

        data_bytes = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data_bytes,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        try:
            with urllib.request.urlopen(req, timeout=120.0) as resp:
                result = json.loads(resp.read().decode("utf-8"))
                return result.get("message", {})
        except urllib.error.HTTPError as err:
            err_body = err.read().decode("utf-8") if err.fp else ""
            raise RuntimeError(f"Ollama HTTP {err.code}: {err.reason} - {err_body}")
        except Exception as exc:
            raise RuntimeError(f"Ollama request failed: {exc}")


# ---------------------------------------------------------------------------
# Interactive Terminal REPL (OpenCode / Claude Code UX)
# ---------------------------------------------------------------------------

class OpenInstinctREPL:
    """The interactive terminal interface for OpenInstinct."""

    def __init__(self, cfg: Optional[Config] = None):
        self.cfg = cfg or Config.from_env()
        self.project_root = Path(__file__).resolve().parents[2]
        self.memory = MemoryStore(self.project_root / ".openagent" / "memory.json")
        
        # Resolve model configuration
        model_name = os.getenv("OPENINSTINCT_MODEL", "qwen2.5-coder:7b").strip()
        ollama_url = os.getenv("OPENINSTINCT_OLLAMA_URL", "http://localhost:11434").strip()
        try:
            temp = float(os.getenv("OPENINSTINCT_TEMPERATURE", "0.2"))
        except ValueError:
            temp = 0.2

        self.client = OllamaClient(base_url=ollama_url, model=model_name, temperature=temp)

        # Initialize OpenAgent local execution adapters
        self.harness: Optional[Harness] = None
        self.mac_adapter: Optional[Any] = None
        self.browser_adapter: Optional[Any] = None
        self.firecrawl_adapter: Optional[Any] = None
        self.loco_adapter: Optional[Any] = None
        self._init_adapters()

        # Conversation history buffer
        self.messages: List[Dict[str, Any]] = []
        self._init_session()

        # Set up command history with readline
        self.history_file = Path.home() / ".openagent_history"
        self._setup_readline()

    def _init_adapters(self):
        try:
            self.harness = Harness()
        except Exception as exc:
            logger.warning("Could not initialize Harness: %s", exc)

        try:
            if MacAdapter is not None:
                self.mac_adapter = MacAdapter()
        except Exception as exc:
            logger.warning("Could not initialize MacAdapter: %s", exc)

        try:
            if BrowserAdapter is not None:
                self.browser_adapter = BrowserAdapter()
        except Exception as exc:
            logger.warning("Could not initialize BrowserAdapter: %s", exc)

        try:
            if FirecrawlAdapter is not None:
                self.firecrawl_adapter = FirecrawlAdapter(
                    api_url=self.cfg.firecrawl_api_url,
                    api_key=self.cfg.firecrawl_api_key,
                )
        except Exception as exc:
            logger.warning("Could not initialize FirecrawlAdapter: %s", exc)

        try:
            if LocoAdapter is not None and self.cfg.locoagent_enabled:
                self.loco_adapter = LocoAdapter(root=self.cfg.locoagent_root or None)
        except Exception as exc:
            logger.warning("Could not initialize LocoAdapter: %s", exc)

    def _init_session(self):
        sys_prompt = build_system_prompt(self.memory, self.project_root)
        self.messages = [{"role": "system", "content": sys_prompt}]

    def _setup_readline(self):
        try:
            if self.history_file.exists():
                readline.read_history_file(str(self.history_file))
            atexit.register(self._save_readline_history)
        except Exception:
            pass

    def _save_readline_history(self):
        try:
            readline.write_history_file(str(self.history_file))
        except Exception:
            pass

    def print_banner(self):
        term_width = min(shutil.get_terminal_size((80, 24)).columns, 90)
        h_line = "─" * (term_width - 2)

        print(f"\n{Colors.CYAN}{Colors.BOLD}╭{h_line}╮{Colors.RESET}")
        title = "⚡ OPENAGENT  ⌘  [BRAIN: OPENINSTINCT]"
        print(f"{Colors.CYAN}{Colors.BOLD}│  {title:<{term_width - 6}}  │{Colors.RESET}")
        tagline = "Autonomous local chief of staff for your Mac, Chrome & Shell"
        print(f"{Colors.CYAN}│  {Colors.DIM}{tagline:<{term_width - 6}}{Colors.RESET}{Colors.CYAN}  │{Colors.RESET}")
        print(f"{Colors.CYAN}{Colors.BOLD}╰{h_line}╯{Colors.RESET}")

        print(f"• {Colors.BOLD}Model:{Colors.RESET}    {Colors.GREEN}{self.client.model}{Colors.RESET} ({self.client.base_url})")
        
        # Engine statuses
        engines = []
        if self.harness: engines.append("cli-harness")
        if self.mac_adapter: engines.append("macos-harness")
        if self.browser_adapter: engines.append("browser-harness")
        if self.firecrawl_adapter: engines.append("firecrawl")
        if self.loco_adapter: engines.append("locoagent")
        eng_str = " ".join([f"[{e}]" for e in engines]) if engines else "[none]"
        print(f"• {Colors.BOLD}Engines:{Colors.RESET}  {Colors.BRIGHT_BLUE}{eng_str}{Colors.RESET}")

        # Active workstreams
        active_ws = self.memory.list_workstreams(active_only=True)
        ws_count = len(active_ws)
        ws_hint = f"{ws_count} active goal{'s' if ws_count != 1 else ''}" if ws_count > 0 else "clean slate"
        print(f"• {Colors.BOLD}Memory:{Colors.RESET}   {Colors.YELLOW}{ws_hint}{Colors.RESET} | {Colors.DIM}Type /help for slash commands{Colors.RESET}")
        print(f"{Colors.DIM}{'─' * term_width}{Colors.RESET}\n")

    def run_doctor(self):
        print(f"\n{Colors.BOLD}{Colors.CYAN}=== OpenInstinct Diagnostics Audit ==={Colors.RESET}")
        # 1. Ollama Health
        ok, msg = self.client.check_health()
        status = f"{Colors.GREEN}✓ ONLINE{Colors.RESET}" if ok else f"{Colors.RED}✗ OFFLINE{Colors.RESET}"
        print(f"• Ollama Engine:    {status} - {msg}")

        # 2. Bun Harness
        h_status = f"{Colors.GREEN}✓ ACTIVE{Colors.RESET}" if self.harness else f"{Colors.YELLOW}⚠ UNAVAILABLE{Colors.RESET}"
        print(f"• CLI Harness:      {h_status} (bash, read, write, edit, grep, glob)")

        # 3. macOS Harness
        m_status = f"{Colors.GREEN}✓ ACTIVE{Colors.RESET}" if self.mac_adapter else f"{Colors.YELLOW}⚠ UNAVAILABLE{Colors.RESET}"
        print(f"• macOS Harness:    {m_status} (native clicks, keystrokes, AX inspection)")

        # 4. Chrome CDP
        c_status = f"{Colors.GREEN}✓ ACTIVE{Colors.RESET}" if self.browser_adapter else f"{Colors.YELLOW}⚠ UNAVAILABLE{Colors.RESET}"
        print(f"• Browser Harness:  {c_status} (real Chrome background CDP)")

        # 5. Firecrawl
        fc_status = f"{Colors.GREEN}✓ ACTIVE{Colors.RESET}" if self.firecrawl_adapter else f"{Colors.YELLOW}⚠ DISABLED{Colors.RESET}"
        print(f"• Firecrawl Engine: {fc_status} (web crawling & markdown scraper)")

        # 6. LocoAgent
        loco_status = f"{Colors.GREEN}✓ ACTIVE{Colors.RESET}" if self.loco_adapter else f"{Colors.YELLOW}⚠ DISABLED{Colors.RESET}"
        print(f"• LocoAgent Social: {loco_status} (Threads, Reddit, X sessions)")
        print(f"{Colors.BOLD}{Colors.CYAN}======================================{Colors.RESET}\n")

    def handle_command(self, cmd: str) -> bool:
        cmd = cmd.strip()
        if cmd in ("/exit", "/quit", "exit", "quit"):
            print(f"\n{Colors.DIM}Saving memory & standing by. Talk soon.{Colors.RESET}")
            self.memory.save()
            return True

        if cmd == "/clear":
            os.system("clear")
            self._init_session()
            self.print_banner()
            print(f"{Colors.GREEN}Conversation cleared. Profile & workstreams preserved.{Colors.RESET}\n")
            return False

        if cmd == "/doctor":
            self.run_doctor()
            return False

        if cmd == "/workstreams":
            ws_list = self.memory.list_workstreams(active_only=False)
            if not ws_list:
                print(f"{Colors.DIM}No workstreams tracked yet.{Colors.RESET}\n")
            else:
                print(f"\n{Colors.BOLD}{Colors.YELLOW}Tracked Workstreams:{Colors.RESET}")
                for ws in ws_list:
                    status_col = Colors.GREEN if ws.get("status") == "active" else Colors.DIM
                    print(f"  • {status_col}[{ws.get('status', 'unknown')}]{Colors.RESET} {Colors.BOLD}{ws.get('goal')}{Colors.RESET}")
                    if ws.get("next_step"):
                        print(f"    ↳ Next: {ws.get('next_step')}")
                print()
            return False

        if cmd == "/profile":
            print(f"\n{Colors.BOLD}{Colors.BLUE}User Profile Memory:{Colors.RESET}")
            for k, v in self.memory.profile.items():
                if isinstance(v, list):
                    print(f"  • {Colors.BOLD}{k}:{Colors.RESET}")
                    for item in v:
                        print(f"    - {item}")
                else:
                    print(f"  • {Colors.BOLD}{k}:{Colors.RESET} {v}")
            print()
            return False

        if cmd == "/tools":
            print(f"\n{Colors.BOLD}{Colors.CYAN}Registered Operational Tools ({len(OPENINSTINCT_TOOLS)}):{Colors.RESET}")
            for t in OPENINSTINCT_TOOLS:
                fn = t.get("function", {})
                print(f"  • {Colors.BOLD}{fn.get('name')}{Colors.RESET}: {fn.get('description')}")
            print()
            return False

        if cmd == "/help":
            print(f"""
{Colors.BOLD}OpenInstinct Slash Commands:{Colors.RESET}
  /clear        Reset current turn history (keeps long-term memory)
  /workstreams  View active project goals and pending steps
  /profile      Inspect your persistent profile facts and preferences
  /tools        List all 20+ available local execution tools
  /doctor       Audit subsystem connectivity (Ollama, Bun, Mac, Chrome)
  /exit         Save state and exit cleanly
""")
            return False

        print(f"{Colors.YELLOW}Unknown command: {cmd}. Type /help for commands.{Colors.RESET}\n")
        return False

    def execute_tool(self, tool_call: Dict[str, Any]) -> Dict[str, Any]:
        """Executes a single tool call via OpenAgent adapters or handles memory tools."""
        name = str(tool_call.get("tool", "")).strip().lower()
        args = tool_call.get("args", {})
        if not isinstance(args, dict):
            args = {}

        # 1. Memory / Profile Handlers
        if name == "workstream_save":
            msg = self.memory.save_workstream(
                goal=args.get("goal", ""),
                status=args.get("status", "active"),
                decision=args.get("decision"),
                next_step=args.get("next_step"),
            )
            return {"status": "ok", "tool": name, "result": {"message": msg}}

        if name == "profile_save":
            msg = self.memory.save_profile_fact(
                key=args.get("key", "fact"),
                value=args.get("value", "")
            )
            return {"status": "ok", "tool": name, "result": {"message": msg}}

        # 2. OpenAgent Local Execution Engines
        return execute_tool_call(
            harness=self.harness,
            call=tool_call,
            mac_adapter=self.mac_adapter,
            browser_adapter=self.browser_adapter,
            firecrawl_adapter=self.firecrawl_adapter,
            loco_adapter=self.loco_adapter,
        )

    def step(self, user_text: str):
        """Processes one conversational turn with multi-step tool execution chaining."""
        self.messages.append({"role": "user", "content": user_text})

        max_iterations = 10
        iteration = 0

        while iteration < max_iterations:
            iteration += 1

            # Query Ollama
            try:
                msg = self.client.chat(self.messages, tools=OPENINSTINCT_TOOLS)
            except Exception as exc:
                print(f"\n{Colors.RED}[Error connecting to model]{Colors.RESET} {exc}\n")
                return

            content = msg.get("content", "") or ""
            raw_tool_calls = msg.get("tool_calls", [])

            # Extract parsed tool calls from either Ollama tool_calls array or content text
            calls: List[Dict[str, Any]] = []
            if raw_tool_calls:
                for rc in raw_tool_calls:
                    fn = rc.get("function", {})
                    fn_name = fn.get("name", "")
                    fn_args = fn.get("arguments", {})
                    if isinstance(fn_args, str):
                        try: fn_args = json.loads(fn_args)
                        except Exception: fn_args = {}
                    calls.append({"tool": fn_name, "args": fn_args})
            else:
                # Fallback to dispatcher's robust multi-format parser
                calls = parse_tool_calls(content)

            # If no tools called, we've reached the final conversational answer!
            if not calls:
                # Add assistant message to history
                self.messages.append({"role": "assistant", "content": content})
                # Print clean, human Instinct response
                print(f"\n{Colors.BOLD}{content.strip()}{Colors.RESET}\n")
                break

            # Tools were called: Execute them step-by-step
            # If the model had pre-tool text, display it
            clean_pre_text = content
            for c in calls:
                # Remove raw JSON blobs from pre-text if present
                clean_pre_text = clean_pre_text.replace(json.dumps(c.get("args", {})), "")
            clean_pre_text = clean_pre_text.strip()
            if clean_pre_text and not clean_pre_text.startswith("{"):
                print(f"\n{Colors.DIM}{clean_pre_text}{Colors.RESET}")

            # Append the model's call to message history
            self.messages.append({"role": "assistant", "content": content if content else json.dumps(calls[0])})

            # Execute each called tool
            for call in calls:
                tool_name = call.get("tool", "unknown")
                tool_args = call.get("args", {})
                
                # Format friendly action badge
                arg_preview = ""
                if tool_name == "bash":
                    arg_preview = f" {Colors.CYAN}{tool_args.get('command', '')}{Colors.RESET}"
                elif tool_name in ("read", "write", "edit"):
                    arg_preview = f" {Colors.CYAN}{tool_args.get('path', '')}{Colors.RESET}"
                elif tool_name == "mac_see":
                    arg_preview = f" {Colors.CYAN}{tool_args.get('app', 'active window')}{Colors.RESET}"
                elif tool_name == "browser_open":
                    arg_preview = f" {Colors.CYAN}{tool_args.get('url', '')}{Colors.RESET}"
                elif tool_name == "workstream_save":
                    arg_preview = f" {Colors.CYAN}{tool_args.get('goal', '')}{Colors.RESET}"

                print(f"  {Colors.YELLOW}⚡ {tool_name}{Colors.RESET}{arg_preview}...")

                exec_result = self.execute_tool(call)
                status = exec_result.get("status", "unknown")

                # Format compact terminal receipt
                if status == "ok":
                    res_body = exec_result.get("result", {})
                    if tool_name == "bash":
                        exit_c = res_body.get("exit_code", 0)
                        out_snip = res_body.get("output", "").strip()
                        lines = out_snip.splitlines()
                        summary = lines[0] if lines else "done"
                        if len(lines) > 1:
                            summary += f" (+{len(lines)-1} lines)"
                        print(f"    {Colors.GREEN}↳ (exit {exit_c}){Colors.RESET} {Colors.DIM}{summary}{Colors.RESET}")
                    else:
                        print(f"    {Colors.GREEN}↳ done{Colors.RESET}")
                else:
                    err_msg = exec_result.get("error", "execution failed")
                    print(f"    {Colors.RED}↳ error:{Colors.RESET} {err_msg}")

                # Format standardized response block for model feedback
                formatted_resp = format_tool_response(exec_result)
                self.messages.append({
                    "role": "user",
                    "content": formatted_resp
                })

        if iteration >= max_iterations:
            print(f"\n{Colors.YELLOW}[Task loop limit reached ({max_iterations} steps). Pausing for user guidance.]{Colors.RESET}\n")

    def start(self):
        """Main REPL loop."""
        self.print_banner()

        # Check health and print warning if Ollama is not ready
        healthy, h_msg = self.client.check_health()
        if not healthy:
            print(f"{Colors.YELLOW}⚠️  Note:{Colors.RESET} {h_msg}")
            print(f"{Colors.DIM}Start Ollama with 'ollama run {self.client.model}' or run 'ollama serve'.{Colors.RESET}\n")

        prompt_label = f"{Colors.CYAN}{Colors.BOLD}Jarvis{Colors.RESET} ❯ "

        while True:
            try:
                user_input = input(prompt_label).strip()
            except (KeyboardInterrupt, EOFError):
                print(f"\n\n{Colors.DIM}Session paused. Standing by.{Colors.RESET}")
                self.memory.save()
                break

            if not user_input:
                continue

            if user_input.startswith("/"):
                should_exit = self.handle_command(user_input)
                if should_exit:
                    break
                continue

            self.step(user_input)


# ---------------------------------------------------------------------------
# Runner Entry Point
# ---------------------------------------------------------------------------

def run_openinstinct_brain(cfg: Optional[Config] = None):
    """Entry point to launch the OpenInstinct REPL."""
    repl = OpenInstinctREPL(cfg=cfg)
    repl.start()


if __name__ == "__main__":
    run_openinstinct_brain()
