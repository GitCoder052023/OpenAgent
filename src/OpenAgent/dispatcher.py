"""Tool call parser, executor, and formatter for Jarvis Bridge over WhatsApp.

Enables Jarvis (the remote AI on WhatsApp) to invoke local Mac harness tools:
1. Jarvis sends a message containing a tool call (e.g. ```json {"tool": "bash", "args": {"command": "git status"}}```).
2. Jarvis Bridge intercepts the message.
3. The harness executes the tool on the local Mac.
4. The bridge formats the execution result and sends it back to WhatsApp as text.
"""

import ast
import base64
import json
import logging
import re
from typing import Any, Dict, List, Optional
from .harness import Harness, HarnessError, OpenCodeHarness

try:
    from .mac_adapter import MacAdapter
except ImportError:
    MacAdapter = None  # type: ignore[assignment,misc]

try:
    from .browser_adapter import BrowserAdapter
except ImportError:
    BrowserAdapter = None  # type: ignore[assignment,misc]

try:
    from .firecrawl_adapter import FirecrawlAdapter, FirecrawlError
except ImportError:
    FirecrawlAdapter = None  # type: ignore[assignment,misc]
    FirecrawlError = Exception  # type: ignore[assignment,misc]

_DEFAULT_MAC_ADAPTER: Optional[Any] = None
_DEFAULT_BROWSER_ADAPTER: Optional[Any] = None
_DEFAULT_FIRECRAWL_ADAPTER: Optional[Any] = None


def get_default_mac_adapter() -> Optional[Any]:
    global _DEFAULT_MAC_ADAPTER
    if _DEFAULT_MAC_ADAPTER is None and MacAdapter is not None:
        try:
            _DEFAULT_MAC_ADAPTER = MacAdapter()
        except Exception as exc:
            logger.warning("Could not initialize default MacAdapter: %s", exc)
    return _DEFAULT_MAC_ADAPTER


def get_default_browser_adapter() -> Optional[Any]:
    global _DEFAULT_BROWSER_ADAPTER
    if _DEFAULT_BROWSER_ADAPTER is None and BrowserAdapter is not None:
        try:
            _DEFAULT_BROWSER_ADAPTER = BrowserAdapter()
        except Exception as exc:
            logger.warning("Could not initialize default BrowserAdapter: %s", exc)
    return _DEFAULT_BROWSER_ADAPTER


def get_default_firecrawl_adapter() -> Optional[Any]:
    global _DEFAULT_FIRECRAWL_ADAPTER
    if _DEFAULT_FIRECRAWL_ADAPTER is None and FirecrawlAdapter is not None:
        try:
            _DEFAULT_FIRECRAWL_ADAPTER = FirecrawlAdapter()
        except Exception as exc:
            logger.warning("Could not initialize default FirecrawlAdapter: %s", exc)
    return _DEFAULT_FIRECRAWL_ADAPTER


logger = logging.getLogger("jarvis.dispatcher")

MAX_WHATSAPP_RESPONSE_LEN = 3500

# ---------------------------------------------------------------------------
# JARVIS_CALL envelope (primary transport)
# ---------------------------------------------------------------------------
# WhatsApp renders outgoing messages: backticks become monospace spans and the
# formatting characters * _ ~ are consumed. A raw JSON tool call can therefore
# arrive mangled. The envelope carries the tool call as standard base64, whose
# alphabet has no WhatsApp formatting characters, so it survives untouched.
#
#   JARVIS_CALL:<standard base64 of the UTF-8 JSON call or array of calls>:END
#
# Multiple envelopes per message are allowed; whitespace/newlines inside the
# base64 payload are tolerated.

ENVELOPE_PREFIX = "JARVIS_CALL:"
ENVELOPE_SUFFIX = ":END"
_ENVELOPE_RE = re.compile(
    re.escape(ENVELOPE_PREFIX) + r"([A-Za-z0-9+/=\s]+)" + re.escape(ENVELOPE_SUFFIX)
)

# Characters WhatsApp rendering / mobile keyboards inject that break naive parsing.
_SMART_QUOTES = {
    "\u201c": '"', "\u201d": '"', "\u201e": '"', "\u201f": '"',
    "\u2018": "'", "\u2019": "'", "\u201a": "'", "\u201b": "'",
}
_ZERO_WIDTH_CHARS = ("\u200b", "\u200c", "\u200d", "\u200e", "\u200f", "\u2060", "\ufeff")


def encode_tool_call(call: Any) -> str:
    """Encode a tool call (dict or list of dicts) as a JARVIS_CALL envelope string."""
    payload = base64.b64encode(json.dumps(call).encode("utf-8")).decode("ascii")
    return f"{ENVELOPE_PREFIX}{payload}{ENVELOPE_SUFFIX}"


def _decode_envelope(payload_b64: str) -> Optional[Any]:
    """Decode one envelope payload, tolerating embedded whitespace. None on failure."""
    compact = re.sub(r"\s+", "", payload_b64)
    if not compact:
        return None
    compact += "=" * (-len(compact) % 4)  # tolerate lost padding
    try:
        raw = base64.b64decode(compact, validate=True)
    except Exception:
        return None
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        return None
    try:
        return json.loads(text)
    except Exception:
        return None


def _sanitize_rendered_text(text: str) -> str:
    """Normalize characters WhatsApp rendering / mobile keyboards inject into text."""
    for ch in _ZERO_WIDTH_CHARS:
        text = text.replace(ch, "")
    for smart, plain in _SMART_QUOTES.items():
        text = text.replace(smart, plain)
    return text.replace("\u00a0", " ")



def _normalize_call(obj: Any) -> Optional[Dict[str, Any]]:
    """Normalize various LLM tool call schemas into {"tool": str, "args": dict}."""
    if not isinstance(obj, dict):
        return None

    # OpenAI format: {"type": "function", "function": {"name": "...", "arguments": "{...}"}}
    if "function" in obj and isinstance(obj["function"], dict):
        fn = obj["function"]
        tool = fn.get("name")
        raw_args = fn.get("arguments", {})
    # Anthropic format: {"type": "tool_use", "name": "...", "input": {...}}
    elif obj.get("type") == "tool_use" and "name" in obj:
        tool = obj.get("name")
        raw_args = obj.get("input", {})
    else:
        # Standard formats: {"tool": ..., "args": ...} or {"name": ..., "arguments": ...}
        tool = obj.get("tool") or obj.get("name")
        raw_args = obj.get("args") if "args" in obj else obj.get("arguments", obj.get("parameters", obj.get("input", {})))

    if not tool or not isinstance(tool, str):
        return None

    tool = tool.strip().lower()

    # Parse arguments if passed as a serialized JSON string
    if isinstance(raw_args, str):
        try:
            args = json.loads(raw_args)
        except Exception:
            try:
                args = ast.literal_eval(raw_args)
            except Exception:
                args = {"raw_input": raw_args}
    elif isinstance(raw_args, dict):
        args = raw_args
    else:
        args = {}

    return {"tool": tool, "args": args}


def _extract_balanced_chunks(text: str) -> List[str]:
    """Extract substring chunks that start with { or [ and have balanced braces/brackets."""
    chunks = []
    stack = []
    start = -1
    in_string = None
    escape = False

    for i, ch in enumerate(text):
        if escape:
            escape = False
            continue
        if ch == "\\" and in_string:
            escape = True
            continue
        if ch in ('"', "'"):
            if in_string is None:
                in_string = ch
            elif in_string == ch:
                in_string = None
            continue
        if in_string:
            continue

        if ch in ("{", "["):
            if not stack:
                start = i
            stack.append(ch)
        elif ch in ("}", "]"):
            if not stack:
                continue
            top = stack[-1]
            if (ch == "}" and top == "{") or (ch == "]" and top == "["):
                stack.pop()
                if not stack:
                    chunks.append(text[start : i + 1])
                    start = -1
            else:
                stack.clear()
                start = -1
    return chunks


def parse_tool_calls(text: str) -> List[Dict[str, Any]]:
    """Extract all tool call specifications from an incoming WhatsApp message.

    Primary transport (WhatsApp-proof):
    0. JARVIS_CALL envelopes:
       JARVIS_CALL:<standard base64 of UTF-8 JSON call or array>:END
       Multiple envelopes per message; whitespace inside the base64 is fine.

    Fallback transports (legacy, best-effort over WhatsApp-rendered text):
    1. Markdown code fences (```json ... ``` or ```tool ... ```)
    2. XML-style tags: <tool_call>{...}</tool_call>
    3. Standalone JSON objects or arrays anywhere in the text
    4. Python single-quoted dict literals
    Fallbacks run on the raw text, then on a sanitized copy (zero-width
    characters stripped, smart quotes normalized).
    """
    if not text or not text.strip():
        return []

    calls: List[Dict[str, Any]] = []

    def add_candidate(cand: Any):
        if isinstance(cand, list):
            for item in cand:
                norm = _normalize_call(item)
                if norm:
                    calls.append(norm)
        elif isinstance(cand, dict):
            norm = _normalize_call(cand)
            if norm:
                calls.append(norm)

    cleaned = text.strip()

    # Sanitized copy first: zero-width chars inside the prefix or payload break
    # the envelope regex, and WhatsApp inserts them around punctuation.
    variants = [cleaned]
    sanitized = _sanitize_rendered_text(cleaned)
    if sanitized != cleaned:
        variants.append(sanitized)

    # 0. Primary transport: JARVIS_CALL envelopes (base64 survives WhatsApp rendering)
    for variant in variants:
        for env_match in _ENVELOPE_RE.finditer(variant):
            parsed = _decode_envelope(env_match.group(1))
            if parsed is not None:
                add_candidate(parsed)
            else:
                logger.warning("Ignoring JARVIS_CALL envelope that failed to decode.")
        if calls:
            return calls

    # Fallback transports on the raw text, then on the sanitized copy.
    for variant in variants:
        _parse_legacy_calls(variant, calls, add_candidate)
        if calls:
            break

    return calls


def _parse_legacy_calls(cleaned: str, calls: List[Dict[str, Any]], add_candidate) -> None:
    """Legacy best-effort extraction from WhatsApp-rendered text."""
    # 1. XML-style <tool_call>...</tool_call>
    for xml_match in re.finditer(r"<tool_call>\s*(.*?)\s*</tool_call>", cleaned, re.DOTALL | re.IGNORECASE):
        content = xml_match.group(1).strip()
        try:
            parsed = json.loads(content)
            add_candidate(parsed)
            continue
        except Exception:
            pass
        try:
            parsed = ast.literal_eval(content)
            add_candidate(parsed)
        except Exception:
            pass

    # 2. Markdown fenced code blocks (```json ... ``` or ```tool ... ``` or ``` ... ```)
    for block_match in re.finditer(r"```(?:json|tool)?\s*([\s\S]*?)\s*```", cleaned, re.IGNORECASE):
        content = block_match.group(1).strip()
        try:
            parsed = json.loads(content)
            add_candidate(parsed)
            continue
        except Exception:
            pass
        try:
            parsed = ast.literal_eval(content)
            add_candidate(parsed)
        except Exception:
            pass

    # 3. If no calls found yet, scan for JSON objects/arrays directly in text using raw_decode
    if not calls:
        decoder = json.JSONDecoder()
        idx = 0
        length = len(cleaned)
        while idx < length:
            char = cleaned[idx]
            if char in ("{", "["):
                try:
                    obj, end_idx = decoder.raw_decode(cleaned, idx)
                    add_candidate(obj)
                    idx = end_idx
                    continue
                except Exception:
                    pass
            idx += 1

    # 4. Fallback: balanced brace scanning for python literals or complex objects
    if not calls:
        for chunk in _extract_balanced_chunks(cleaned):
            try:
                parsed = json.loads(chunk)
                add_candidate(parsed)
                continue
            except Exception:
                pass
            try:
                parsed = ast.literal_eval(chunk)
                add_candidate(parsed)
            except Exception:
                pass


def parse_tool_call(text: str) -> Optional[Dict[str, Any]]:
    """Extract the first tool call specification from text, or None."""
    calls = parse_tool_calls(text)
    return calls[0] if calls else None


def execute_tool_call(
    harness: Optional[Harness],
    call: Dict[str, Any],
    mac_adapter: Optional[Any] = None,
    browser_adapter: Optional[Any] = None,
    firecrawl_adapter: Optional[Any] = None,
) -> Dict[str, Any]:
    """Execute a parsed tool call using the headless harness, native macOS adapter, browser adapter, or Firecrawl.

    Returns a standardized dictionary:
    {"status": "ok" | "error", "tool": name, "result": ..., "error": ...}
    """
    tool = str(call.get("tool", "")).strip().lower()
    args = call.get("args", {})
    if not isinstance(args, dict):
        args = {}

    if mac_adapter is None:
        mac_adapter = get_default_mac_adapter()

    if browser_adapter is None:
        if mac_adapter is not None and hasattr(mac_adapter, "browser"):
            browser_adapter = mac_adapter.browser
        else:
            browser_adapter = get_default_browser_adapter()

    if firecrawl_adapter is None:
        if mac_adapter is not None and hasattr(mac_adapter, "firecrawl") and mac_adapter.firecrawl is not None:
            firecrawl_adapter = mac_adapter.firecrawl
        else:
            firecrawl_adapter = get_default_firecrawl_adapter()

    try:
        # --- Native macOS Computer-Use Primitives (macos-harness) ---
        if tool in ("mac_python", "mac_run", "python", "mac_script"):
            if mac_adapter is None:
                raise RuntimeError("macOS Harness adapter is not available on this system")
            code = args.get("code") or args.get("script") or args.get("command")
            if not code:
                raise ValueError("Missing 'code' argument for mac_python tool")
            timeout = float(args.get("timeout", args.get("timeout_s", 30.0)))
            res = mac_adapter.run_python(code=code, timeout=timeout)
            status = res.get("status", "ok")
            if status == "error":
                return {"status": "error", "tool": tool, "error": res.get("error", "Python script failed"), "result": res}
            return {"status": "ok", "tool": tool, "result": res}

        elif tool in ("mac_see", "see"):
            if mac_adapter is None:
                raise RuntimeError("macOS Harness adapter is not available on this system")
            res = mac_adapter.see(
                app=args.get("app"),
                window_index=int(args.get("window_index", 0)),
                max_width=int(args.get("max_width", 1280)),
                max_height=int(args.get("max_height", 1280)),
                send_image=bool(args.get("send_image", False)),
                include_summary=bool(args.get("include_summary", True)),
            )
            return {"status": "ok", "tool": tool, "result": res}

        elif tool in ("mac_click", "click"):
            if mac_adapter is None:
                raise RuntimeError("macOS Harness adapter is not available on this system")
            x = args.get("x")
            y = args.get("y")
            if x is None or y is None:
                raise ValueError("Missing 'x' or 'y' coordinates for mac_click")
            res = mac_adapter.click(
                x=float(x),
                y=float(y),
                app=args.get("app"),
                button=args.get("button", "left"),
                click_count=int(args.get("click_count", 1)),
            )
            return {"status": "ok", "tool": tool, "result": res}

        elif tool in ("mac_move", "move"):
            if mac_adapter is None:
                raise RuntimeError("macOS Harness adapter is not available on this system")
            x = args.get("x")
            y = args.get("y")
            if x is None or y is None:
                raise ValueError("Missing 'x' or 'y' coordinates for mac_move")
            res = mac_adapter.move(x=float(x), y=float(y), app=args.get("app"))
            return {"status": "ok", "tool": tool, "result": res}

        elif tool in ("mac_type", "type"):
            if mac_adapter is None:
                raise RuntimeError("macOS Harness adapter is not available on this system")
            text = args.get("text")
            if text is None:
                raise ValueError("Missing 'text' argument for mac_type")
            res = mac_adapter.type(text=str(text), app=args.get("app"))
            return {"status": "ok", "tool": tool, "result": res}

        elif tool in ("mac_key", "key"):
            if mac_adapter is None:
                raise RuntimeError("macOS Harness adapter is not available on this system")
            key = args.get("key")
            if not key:
                raise ValueError("Missing 'key' argument for mac_key")
            res = mac_adapter.key(key=str(key), app=args.get("app"))
            return {"status": "ok", "tool": tool, "result": res}

        elif tool in ("mac_drag", "drag"):
            if mac_adapter is None:
                raise RuntimeError("macOS Harness adapter is not available on this system")
            start_x = args.get("start_x", args.get("from_x"))
            start_y = args.get("start_y", args.get("from_y"))
            end_x = args.get("end_x", args.get("to_x"))
            end_y = args.get("end_y", args.get("to_y"))
            if any(v is None for v in (start_x, start_y, end_x, end_y)):
                raise ValueError("Missing start or end coordinates for mac_drag")
            res = mac_adapter.drag(
                start_x=float(start_x),
                start_y=float(start_y),
                end_x=float(end_x),
                end_y=float(end_y),
                app=args.get("app"),
                duration=float(args.get("duration", 0.35)),
                button=args.get("button", "left"),
            )
            return {"status": "ok", "tool": tool, "result": res}

        elif tool in ("mac_scroll", "scroll"):
            if mac_adapter is None:
                raise RuntimeError("macOS Harness adapter is not available on this system")
            x = float(args.get("x", 0))
            y = float(args.get("y", 0))
            dx = int(args.get("dx", 0))
            dy = int(args.get("dy", 0))
            res = mac_adapter.scroll(x=x, y=y, dx=dx, dy=dy, app=args.get("app"))
            return {"status": "ok", "tool": tool, "result": res}

        elif tool in ("mac_apps", "apps"):
            if mac_adapter is None:
                raise RuntimeError("macOS Harness adapter is not available on this system")
            res = mac_adapter.list_apps()
            return {"status": "ok", "tool": tool, "result": {"apps": res, "total": len(res)}}

        elif tool in ("mac_windows", "windows"):
            if mac_adapter is None:
                raise RuntimeError("macOS Harness adapter is not available on this system")
            res = mac_adapter.windows(app=args.get("app"))
            return {"status": "ok", "tool": tool, "result": {"windows": res, "total": len(res)}}

        elif tool in ("mac_ax", "ax"):
            if mac_adapter is None:
                raise RuntimeError("macOS Harness adapter is not available on this system")
            res = mac_adapter.ax(
                action=args.get("action", "query"),
                app=args.get("app"),
                x=args.get("x"),
                y=args.get("y"),
                text=args.get("text"),
                element_index=args.get("element_index"),
                element_action=args.get("element_action", "AXPress"),
                attribute=args.get("attribute", "AXValue"),
                value=args.get("value"),
                limit=int(args.get("limit", 20)),
            )
            return {"status": "ok", "tool": tool, "result": res}

        # --- Native Chrome Browser-Use Primitives (browser-harness) ---
        elif tool in ("browser_open", "browser_goto", "browser_navigate"):
            if browser_adapter is None:
                raise RuntimeError("Browser Harness adapter is not available on this system")
            url = args.get("url") or args.get("link")
            if not url:
                raise ValueError("Missing 'url' argument for browser_open")
            new_tab = bool(args.get("new_tab", False))
            res = browser_adapter.open(url=str(url), new_tab=new_tab)
            return {"status": "ok", "tool": tool, "result": res}

        elif tool in ("browser_info", "browser_page_info"):
            if browser_adapter is None:
                raise RuntimeError("Browser Harness adapter is not available on this system")
            res = browser_adapter.page_info()
            return {"status": "ok", "tool": tool, "result": res}

        elif tool in ("browser_click",):
            if browser_adapter is None:
                raise RuntimeError("Browser Harness adapter is not available on this system")
            res = browser_adapter.click(
                x=args.get("x"),
                y=args.get("y"),
                selector=args.get("selector"),
                button=args.get("button", "left"),
                clicks=int(args.get("click_count", args.get("clicks", 1))),
            )
            return {"status": "ok", "tool": tool, "result": res}

        elif tool in ("browser_fill",):
            if browser_adapter is None:
                raise RuntimeError("Browser Harness adapter is not available on this system")
            selector = args.get("selector")
            text = args.get("text") if "text" in args else args.get("value")
            if not selector or text is None:
                raise ValueError("Missing 'selector' or 'text' argument for browser_fill")
            res = browser_adapter.fill(
                selector=str(selector),
                text=str(text),
                clear_first=bool(args.get("clear_first", True)),
                timeout=float(args.get("timeout", 5.0)),
            )
            return {"status": "ok", "tool": tool, "result": res}

        elif tool in ("browser_type",):
            if browser_adapter is None:
                raise RuntimeError("Browser Harness adapter is not available on this system")
            text = args.get("text")
            if text is None:
                raise ValueError("Missing 'text' argument for browser_type")
            res = browser_adapter.type(str(text))
            return {"status": "ok", "tool": tool, "result": res}

        elif tool in ("browser_key",):
            if browser_adapter is None:
                raise RuntimeError("Browser Harness adapter is not available on this system")
            key = args.get("key")
            if not key:
                raise ValueError("Missing 'key' argument for browser_key")
            res = browser_adapter.key(str(key), modifiers=int(args.get("modifiers", 0)))
            return {"status": "ok", "tool": tool, "result": res}

        elif tool in ("browser_scroll",):
            if browser_adapter is None:
                raise RuntimeError("Browser Harness adapter is not available on this system")
            res = browser_adapter.scroll(
                x=float(args.get("x", 0)),
                y=float(args.get("y", 0)),
                dx=int(args.get("dx", 0)),
                dy=int(args.get("dy", -300)),
                selector=args.get("selector"),
            )
            return {"status": "ok", "tool": tool, "result": res}

        elif tool in ("browser_tabs",):
            if browser_adapter is None:
                raise RuntimeError("Browser Harness adapter is not available on this system")
            action = args.get("action", "list")
            res = browser_adapter.tabs(
                action=str(action),
                target=args.get("target"),
                url=args.get("url"),
            )
            return {"status": "ok", "tool": tool, "result": res}

        elif tool in ("browser_see",):
            if browser_adapter is None:
                raise RuntimeError("Browser Harness adapter is not available on this system")
            res = browser_adapter.see(
                send_image=bool(args.get("send_image", False)),
                max_elements=int(args.get("max_elements", 25)),
            )
            return {"status": "ok", "tool": tool, "result": res}

        elif tool in ("browser_screenshot",):
            if browser_adapter is None:
                raise RuntimeError("Browser Harness adapter is not available on this system")
            res = browser_adapter.screenshot(
                path=args.get("path"),
                full=bool(args.get("full", False)),
                max_dim=args.get("max_dim"),
                send_image=bool(args.get("send_image", False)),
            )
            return {"status": "ok", "tool": tool, "result": res}

        elif tool in ("browser_ax",):
            if browser_adapter is None:
                raise RuntimeError("Browser Harness adapter is not available on this system")
            res = browser_adapter.ax(
                action=args.get("action", "query"),
                text=args.get("text"),
                role=args.get("role"),
                limit=int(args.get("limit", 25)),
            )
            return {"status": "ok", "tool": tool, "result": res}

        elif tool in ("browser_eval", "browser_js"):
            if browser_adapter is None:
                raise RuntimeError("Browser Harness adapter is not available on this system")
            expr = args.get("expression") or args.get("script") or args.get("code")
            if not expr:
                raise ValueError("Missing 'expression' argument for browser_eval")
            res = browser_adapter.js(str(expr), target_id=args.get("target_id"))
            return {"status": "ok", "tool": tool, "result": res}

        elif tool in ("browser_wait",):
            if browser_adapter is None:
                raise RuntimeError("Browser Harness adapter is not available on this system")
            res = browser_adapter.wait(
                for_what=args.get("for_what", "load"),
                selector=args.get("selector"),
                timeout=float(args.get("timeout", 15.0)),
            )
            return {"status": "ok", "tool": tool, "result": res}

        elif tool in ("browser_python", "browser_run", "browser_script"):
            if browser_adapter is None:
                raise RuntimeError("Browser Harness adapter is not available on this system")
            code = args.get("code") or args.get("script")
            if not code:
                raise ValueError("Missing 'code' argument for browser_python")
            timeout = float(args.get("timeout", 30.0))
            res = browser_adapter.run_python(code=str(code), timeout=timeout)
            status = res.get("status", "ok")
            if status == "error":
                return {"status": "error", "tool": tool, "error": res.get("error", "Browser script failed"), "result": res}
            return {"status": "ok", "tool": tool, "result": res}

        elif tool in ("browser_skills", "domain_skills"):
            if browser_adapter is None:
                raise RuntimeError("Browser Harness adapter is not available on this system")
            res = browser_adapter.domain_skills(host=args.get("host") or args.get("url"))
            return {"status": "ok", "tool": tool, "result": res}

        elif tool in ("mac_browser", "browser"):
            action = args.get("action", "page_info")
            pass_args = {k: v for k, v in args.items() if k != "action"}
            if browser_adapter is not None:
                res = browser_adapter.browser_op(action, **pass_args)
            elif mac_adapter is not None:
                res = mac_adapter.browser_op(action, **pass_args)
            else:
                raise RuntimeError("Neither Browser Harness nor macOS Harness is available")
            return {"status": "ok", "tool": tool, "result": res}

        elif tool in ("mac_doctor", "doctor"):
            if mac_adapter is None:
                raise RuntimeError("macOS Harness adapter is not available on this system")
            res = mac_adapter.doctor()
            return {"status": "ok", "tool": tool, "result": res}

        # --- Headless Bun Harness Primitives ---
        elif tool == "bash":
            if harness is None:
                raise RuntimeError("Headless Bun harness is not initialized")
            cmd = args.get("command")
            if not cmd:
                raise ValueError("Missing 'command' argument for bash tool")
            res = harness.bash(
                command=cmd,
                cwd=args.get("cwd"),
                timeout_ms=int(args.get("timeout_ms", 60000)),
            )
            return {"status": "ok", "tool": tool, "result": res}

        elif tool == "read":
            if harness is None:
                raise RuntimeError("Headless Bun harness is not initialized")
            path = args.get("path")
            if not path:
                raise ValueError("Missing 'path' argument for read tool")
            offset = args.get("offset")
            limit = args.get("limit")
            res = harness.read(
                path=path,
                offset=int(offset) if offset is not None else None,
                limit=int(limit) if limit is not None else None,
            )
            return {"status": "ok", "tool": tool, "result": res}

        elif tool == "write":
            if harness is None:
                raise RuntimeError("Headless Bun harness is not initialized")
            path = args.get("path")
            content = args.get("content")
            if not path or content is None:
                raise ValueError("Missing 'path' or 'content' argument for write tool")
            res = harness.write(path=path, content=content)
            return {"status": "ok", "tool": tool, "result": res}

        elif tool == "edit":
            if harness is None:
                raise RuntimeError("Headless Bun harness is not initialized")
            path = args.get("path")
            old_str = args.get("oldString") or args.get("old_string")
            new_str = args.get("newString") or args.get("new_string")
            if not path or old_str is None or new_str is None:
                raise ValueError("Missing 'path', 'oldString', or 'newString' for edit tool")
            res = harness.edit(
                path=path,
                old_string=old_str,
                new_string=new_str,
                replace_all=bool(args.get("replaceAll") or args.get("replace_all", False)),
            )
            return {"status": "ok", "tool": tool, "result": res}

        elif tool == "grep":
            if harness is None:
                raise RuntimeError("Headless Bun harness is not initialized")
            pattern = args.get("pattern")
            if not pattern:
                raise ValueError("Missing 'pattern' argument for grep tool")
            res = harness.grep(
                pattern=pattern,
                path=args.get("path", "."),
                include=args.get("include"),
            )
            return {"status": "ok", "tool": tool, "result": res}

        elif tool == "glob":
            if harness is None:
                raise RuntimeError("Headless Bun harness is not initialized")
            pattern = args.get("pattern")
            if not pattern:
                raise ValueError("Missing 'pattern' argument for glob tool")
            res = harness.glob(pattern=pattern, path=args.get("path", "."))
            return {"status": "ok", "tool": tool, "result": res}

        elif tool == "applescript":
            script = args.get("script")
            if not script:
                raise ValueError("Missing 'script' argument for applescript tool")
            if harness is not None:
                output = harness.applescript(script=script)
            elif mac_adapter is not None:
                output = mac_adapter.mac.script(script)
            else:
                raise RuntimeError("Neither harness nor mac_adapter is available for applescript")
            return {"status": "ok", "tool": tool, "result": {"output": output}}

        elif tool == "system_info":
            if harness is not None:
                res = harness.system_info()
            elif mac_adapter is not None:
                res = mac_adapter.doctor()
            else:
                raise RuntimeError("No harness available for system_info")
            return {"status": "ok", "tool": tool, "result": res}

        elif tool == "instructions":
            if harness is None:
                raise RuntimeError("Headless Bun harness is not initialized")
            res = harness.instructions(directory=args.get("directory"))
            return {"status": "ok", "tool": tool, "result": res}

        elif tool == "system_prompt":
            if harness is None:
                raise RuntimeError("Headless Bun harness is not initialized")
            res = harness.system_prompt(
                model=args.get("model", "default"),
                agent=args.get("agent"),
            )
            return {"status": "ok", "tool": tool, "result": res}

        # --- Firecrawl Web Ingestion & Extraction Primitives ---
        elif tool in ("firecrawl_scrape", "scrape", "scrape_url"):
            if firecrawl_adapter is None:
                raise RuntimeError("Firecrawl adapter is not available on this system")
            url = args.get("url") or args.get("link")
            if not url:
                raise ValueError("Missing 'url' argument for firecrawl_scrape")
            formats = args.get("formats")
            if isinstance(formats, str):
                formats = [formats]
            only_main = bool(args.get("only_main_content", args.get("onlyMainContent", True)))
            wait_for = args.get("wait_for", args.get("waitFor"))
            timeout_arg = args.get("timeout")
            res = firecrawl_adapter.scrape(
                url=str(url),
                formats=formats,
                only_main_content=only_main,
                wait_for=int(wait_for) if wait_for is not None else None,
                timeout=int(timeout_arg) if timeout_arg is not None else None,
                include_tags=args.get("include_tags", args.get("includeTags")),
                exclude_tags=args.get("exclude_tags", args.get("excludeTags")),
                headers=args.get("headers"),
            )
            return {"status": "ok", "tool": tool, "result": res}

        elif tool in ("firecrawl_search", "web_search", "search_web"):
            if firecrawl_adapter is None:
                raise RuntimeError("Firecrawl adapter is not available on this system")
            query = args.get("query") or args.get("q")
            if not query:
                raise ValueError("Missing 'query' argument for firecrawl_search")
            limit = int(args.get("limit", 5))
            scrape_options = args.get("scrape_options", args.get("scrapeOptions"))
            res = firecrawl_adapter.search(
                query=str(query),
                limit=limit,
                scrape_options=scrape_options,
            )
            return {"status": "ok", "tool": tool, "result": res}

        elif tool in ("firecrawl_crawl", "crawl", "crawl_site"):
            if firecrawl_adapter is None:
                raise RuntimeError("Firecrawl adapter is not available on this system")
            url = args.get("url") or args.get("link")
            if not url:
                raise ValueError("Missing 'url' argument for firecrawl_crawl")
            max_depth = int(args.get("max_depth", args.get("maxDepth", 2)))
            limit = int(args.get("limit", 10))
            allow_backward = bool(args.get("allow_backward_links", args.get("allowBackwardLinks", False)))
            allow_external = bool(args.get("allow_external_links", args.get("allowExternalLinks", False)))
            scrape_options = args.get("scrape_options", args.get("scrapeOptions"))
            res = firecrawl_adapter.crawl(
                url=str(url),
                max_depth=max_depth,
                limit=limit,
                allow_backward_links=allow_backward,
                allow_external_links=allow_external,
                scrape_options=scrape_options,
            )
            return {"status": "ok", "tool": tool, "result": res}

        elif tool in ("firecrawl_status", "crawl_status"):
            if firecrawl_adapter is None:
                raise RuntimeError("Firecrawl adapter is not available on this system")
            job_id = args.get("job_id") or args.get("id")
            if not job_id:
                raise ValueError("Missing 'job_id' or 'id' for firecrawl_status")
            res = firecrawl_adapter.crawl_status(job_id=str(job_id))
            return {"status": "ok", "tool": tool, "result": res}

        elif tool in ("firecrawl_cancel", "cancel_crawl"):
            if firecrawl_adapter is None:
                raise RuntimeError("Firecrawl adapter is not available on this system")
            job_id = args.get("job_id") or args.get("id")
            if not job_id:
                raise ValueError("Missing 'job_id' or 'id' for firecrawl_cancel")
            res = firecrawl_adapter.cancel_crawl(job_id=str(job_id))
            return {"status": "ok", "tool": tool, "result": res}

        elif tool in ("firecrawl_map", "site_map", "sitemap"):
            if firecrawl_adapter is None:
                raise RuntimeError("Firecrawl adapter is not available on this system")
            url = args.get("url") or args.get("link")
            if not url:
                raise ValueError("Missing 'url' argument for firecrawl_map")
            search_term = args.get("search")
            limit = int(args.get("limit", 100))
            ignore_sitemap = bool(args.get("ignore_sitemap", args.get("ignoreSitemap", False)))
            res = firecrawl_adapter.map(
                url=str(url),
                search=search_term,
                limit=limit,
                ignore_sitemap=ignore_sitemap,
            )
            return {"status": "ok", "tool": tool, "result": res}

        elif tool in ("firecrawl_extract", "extract"):
            if firecrawl_adapter is None:
                raise RuntimeError("Firecrawl adapter is not available on this system")
            urls = args.get("urls") or args.get("url")
            if not urls:
                raise ValueError("Missing 'urls' argument for firecrawl_extract")
            prompt = args.get("prompt")
            schema = args.get("schema")
            res = firecrawl_adapter.extract(
                urls=urls,
                prompt=prompt,
                schema=schema,
            )
            return {"status": "ok", "tool": tool, "result": res}

        elif tool in ("firecrawl_doctor", "firecrawl_health"):
            if firecrawl_adapter is None:
                raise RuntimeError("Firecrawl adapter is not available on this system")
            res = firecrawl_adapter.doctor()
            return {"status": "ok", "tool": tool, "result": res}

        else:
            raise ValueError(f"Unknown harness tool: '{tool}'")

    except (HarnessError, FirecrawlError) as err:
        logger.warning("Execution error for tool '%s': %s", tool, err)
        return {"status": "error", "tool": tool, "error": str(err)}
    except Exception as exc:
        logger.exception("Unexpected execution error for tool '%s': %s", tool, exc)
        return {"status": "error", "tool": tool, "error": str(exc)}



def format_tool_response(response: Dict[str, Any], max_length: int = MAX_WHATSAPP_RESPONSE_LEN, prefix_header: str = "") -> str:
    """Format an execution result into a readable markdown response for Jarvis on WhatsApp."""
    tool = response.get("tool", "unknown")
    status = response.get("status", "unknown")

    header = prefix_header or f"[Jarvis Tool Response: {tool} | status: {status}]"

    if status == "error":
        error_msg = response.get("error", "Unknown error")
        return f"{header}\nError: {error_msg}"

    result = response.get("result", {})

    # Tool-specific user-friendly formatting
    body = ""
    if tool == "bash":
        exit_code = result.get("exit_code")
        output = result.get("output", "")
        timed_out = result.get("timed_out", False)
        prefix = f"(exit {exit_code}{', timed out' if timed_out else ''})\n"
        body = prefix + (output if output.strip() else "(no output)")

    elif tool == "read":
        if result.get("type") == "directory":
            entries = [e.get("name", "") for e in result.get("entries", [])]
            total = result.get("total_entries", len(entries))
            body = f"Directory: {result.get('path')}\nTotal entries: {total}\n" + "\n".join(entries)
        else:
            content = result.get("content", "")
            lines_returned = result.get("lines_returned", 0)
            body = f"File: {result.get('path')} ({lines_returned} lines):\n{content}"

    elif tool == "write":
        body = f"Successfully written {result.get('bytes_written', 0)} bytes to {result.get('path')}"

    elif tool == "edit":
        reps = result.get("replacements", 0)
        diff = result.get("diff", "")
        body = f"Replacements: {reps}\n{diff}"

    elif tool == "grep":
        matches = result.get("matches", [])
        total = result.get("total_matches", len(matches))
        body = f"Pattern: {result.get('pattern')} ({total} matches):\n"
        formatted_matches = [f"{m.get('file')}:{m.get('line')}: {m.get('text')}" for m in matches[:50]]
        body += "\n".join(formatted_matches)
        if total > 50:
            body += f"\n... and {total - 50} more matches."

    elif tool == "glob":
        matches = result.get("matches", [])
        body = f"Pattern: {result.get('pattern')} ({len(matches)} files):\n" + "\n".join(matches)

    elif tool == "applescript":
        body = result.get("output", "(success, no output)")

    elif tool in ("mac_python", "mac_run", "python", "mac_script"):
        stdout = result.get("stdout") or "(no stdout output)"
        stderr = result.get("stderr")
        dur = result.get("duration_s", 0)
        body = f"Burst execution ({dur}s):\n{stdout}"
        if stderr:
            body += f"\n[stderr]\n{stderr}"
        if result.get("last_screenshot"):
            shot = result["last_screenshot"]
            body += f"\n[Screenshot: {shot.get('app')} ({shot.get('width')}x{shot.get('height')})]"

    elif tool in ("mac_see", "see"):
        app_name = result.get("app", "frontmost")
        w = result.get("width", 0)
        h = result.get("height", 0)
        body = f"Captured '{app_name}' (window {result.get('window_index', 0)}, {w}x{h})"
        if result.get("_send_attachment"):
            body += "\n[Screenshot attachment queued for WhatsApp delivery]"
        controls = result.get("interactive_controls", [])
        if controls:
            body += "\n\nVisible Interactive Controls:\n" + "\n".join(f"• {c}" for c in controls[:15])

    elif tool in ("mac_click", "click"):
        app_name = result.get("app") or "target app"
        body = f"Clicked ({result.get('x')}, {result.get('y')}) on {app_name} [{result.get('button')}, count={result.get('click_count', 1)}]"

    elif tool in ("mac_move", "move"):
        body = f"Moved pointer overlay to ({result.get('x')}, {result.get('y')})"

    elif tool in ("mac_type", "type"):
        app_name = result.get("app") or "target app"
        body = f"Typed {result.get('length', 0)} characters into {app_name}"

    elif tool in ("mac_key", "key"):
        app_name = result.get("app") or "target app"
        body = f"Sent key '{result.get('key')}' to {app_name}"

    elif tool in ("mac_drag", "drag"):
        body = f"Dragged from {result.get('from')} to {result.get('to')} on {result.get('app') or 'target'}"

    elif tool in ("mac_scroll", "scroll"):
        body = f"Scrolled at ({result.get('x')}, {result.get('y')}) by (dx={result.get('dx')}, dy={result.get('dy')})"

    elif tool in ("mac_apps", "apps"):
        apps_list = [f"• {a.get('name')} (PID {a.get('pid')})" for a in result.get("apps", [])]
        body = f"Running Applications ({result.get('total', len(apps_list))}):\n" + "\n".join(apps_list[:30])

    elif tool in ("mac_windows", "windows"):
        wins = [f"• {w.get('title') or '(Untitled)'}: bounds={w.get('bounds')}" for w in result.get("windows", [])]
        body = f"Open Windows ({result.get('total', len(wins))}):\n" + "\n".join(wins[:20])

    elif tool in ("browser_open", "browser_goto", "browser_navigate"):
        url = result.get("url") or "URL"
        title = result.get("title") or "(no title)"
        body = f"Navigated to: {url}\nTitle: {title}"
        skills = result.get("navigation", {}).get("domain_skills", [])
        if skills:
            body += f"\nDomain Skills: {', '.join(skills[:5])}"

    elif tool in ("browser_info", "browser_page_info"):
        url = result.get("url") or "URL"
        title = result.get("title") or "(no title)"
        w = result.get("w", 0)
        h = result.get("h", 0)
        sx = result.get("sx", 0)
        sy = result.get("sy", 0)
        body = f"Chrome Tab Info:\n• Title: {title}\n• URL: {url}\n• Viewport: {w}x{h} (scroll: {sx},{sy})"

    elif tool in ("browser_click",):
        sel = f" [{result.get('selector')}]" if result.get("selector") else ""
        body = f"Clicked ({result.get('x')}, {result.get('y')}){sel} on Chrome [{result.get('button')}, count={result.get('click_count', 1)}]"

    elif tool in ("browser_fill",):
        body = f"Filled input '{result.get('selector')}' ({result.get('length', 0)} chars)"

    elif tool in ("browser_type",):
        body = f"Typed {result.get('length', 0)} characters into Chrome"

    elif tool in ("browser_key",):
        body = f"Sent key '{result.get('key')}' to Chrome"

    elif tool in ("browser_scroll",):
        if result.get("selector"):
            body = f"Scrolled element '{result.get('selector')}' into view"
        else:
            body = f"Scrolled Chrome at ({result.get('x')}, {result.get('y')}) by (dx={result.get('dx')}, dy={result.get('dy')})"

    elif tool in ("browser_tabs",):
        action = result.get("action", "tabs")
        if action == "list":
            tabs_list = result.get("tabs", [])
            body = f"Open Chrome Tabs ({len(tabs_list)}):\n"
            for t in tabs_list[:15]:
                marker = "🐎 " if t.get("selected") else "• "
                body += f"{marker}{t.get('title') or '(Untitled)'} ({t.get('url')})\n"
        else:
            body = f"Tab {action} performed successfully"

    elif tool in ("browser_see", "browser_screenshot"):
        title = result.get("title") or "Chrome"
        url = result.get("url") or ""
        body = f"Captured Chrome: '{title}' ({url})"
        if result.get("_send_attachment"):
            body += "\n[Screenshot attachment queued for WhatsApp delivery]"
        controls = result.get("interactive_controls", [])
        if controls:
            body += "\n\nVisible Controls:\n" + "\n".join(f"• {c}" for c in controls[:15])

    elif tool in ("browser_ax",):
        elements = result.get("elements", [])
        body = f"Browser AX Elements ({result.get('total', len(elements))}):\n"
        for e in elements[:15]:
            coords = f" at ({e.get('x')}, {e.get('y')})" if "x" in e and "y" in e else ""
            body += f"• {e.get('role')}: '{e.get('name') or e.get('value')}'{coords}\n"

    elif tool in ("browser_python", "browser_run", "browser_script"):
        stdout = result.get("stdout") or "(no stdout output)"
        stderr = result.get("stderr")
        dur = result.get("duration_s", 0)
        body = f"Browser burst execution ({dur}s):\n{stdout}"
        if stderr:
            body += f"\n[stderr]\n{stderr}"

    elif tool in ("browser_eval", "browser_js"):
        body = f"JS Evaluation Result:\n{json.dumps(result, indent=2) if isinstance(result, (dict, list)) else str(result)}"

    elif tool in ("browser_wait",):
        body = f"Wait completed for {result.get('waited_for', 'load')}"

    elif tool in ("browser_skills", "domain_skills"):
        skills = result if isinstance(result, list) else []
        body = f"Domain Skills ({len(skills)}):\n" + "\n".join(f"• {s.get('skill')}: {s.get('file')}" for s in skills)

    elif tool in ("firecrawl_scrape", "scrape", "scrape_url"):
        data = result.get("data", result) if isinstance(result, dict) else {}
        meta = data.get("metadata", {}) if isinstance(data, dict) else {}
        title = meta.get("title") or meta.get("og:title") or "Web Page"
        source_url = meta.get("sourceURL") or meta.get("url") or result.get("url") or ""
        md = data.get("markdown", "") if isinstance(data, dict) else ""
        body = f"Title: {title}\nURL: {source_url}\n\n{md}".strip()

    elif tool in ("firecrawl_search", "web_search", "search_web"):
        hits = result.get("data", result.get("results", [])) if isinstance(result, dict) else []
        if isinstance(hits, list):
            body = f"Search Results ({len(hits)} hits):\n\n"
            for i, hit in enumerate(hits, 1):
                if not isinstance(hit, dict):
                    continue
                h_meta = hit.get("metadata", {}) if isinstance(hit, dict) else {}
                h_title = h_meta.get("title") or hit.get("title") or "Result"
                h_url = h_meta.get("sourceURL") or hit.get("url") or ""
                h_md = (hit.get("markdown") or hit.get("snippet") or "")[:400].strip()
                body += f"[{i}] {h_title}\nURL: {h_url}\n{h_md}\n\n"
        else:
            body = json.dumps(result, indent=2)

    elif tool in ("firecrawl_crawl", "crawl", "crawl_site"):
        job_id = result.get("id") or result.get("job_id") or "submitted"
        url = result.get("url") or "target site"
        body = f"Crawl Initiated: {url}\nJob ID: {job_id}\nUse firecrawl_status to monitor progress."

    elif tool in ("firecrawl_status", "crawl_status"):
        st = result.get("status") or "unknown"
        tot = result.get("total", 0)
        done = result.get("completed", 0)
        data = result.get("data", [])
        body = f"Crawl Status: {st} ({done}/{tot} pages crawled)"
        if data and isinstance(data, list):
            body += "\nRecent pages:\n"
            for item in data[:5]:
                if isinstance(item, dict):
                    m = item.get("metadata", {}) if isinstance(item, dict) else {}
                    body += f"• {m.get('title') or '(Untitled)'} ({m.get('sourceURL') or item.get('url')})\n"

    elif tool in ("firecrawl_cancel", "cancel_crawl"):
        body = f"Crawl job canceled: {result.get('status', 'ok')}"

    elif tool in ("firecrawl_map", "site_map", "sitemap"):
        links = result.get("links", []) if isinstance(result, dict) else []
        body = f"Discovered Links ({len(links)}):\n" + "\n".join(f"• {link}" for link in links[:30])
        if len(links) > 30:
            body += f"\n... and {len(links) - 30} more links."

    elif tool in ("firecrawl_extract", "extract"):
        extracted = result.get("data", result)
        body = f"Extracted Data:\n{json.dumps(extracted, indent=2) if isinstance(extracted, (dict, list)) else str(extracted)}"

    elif tool in ("firecrawl_doctor", "firecrawl_health"):
        body = f"Firecrawl Health: {result.get('status', 'unknown')}\nEndpoint: {result.get('api_url', '')}\nReachable: {result.get('reachable', False)}"

    elif tool in ("system_info", "instructions", "system_prompt", "mac_ax", "ax", "mac_browser", "browser", "mac_doctor", "doctor"):
        body = json.dumps(result, indent=2)

    else:
        body = json.dumps(result, indent=2)

    # Truncation check for WhatsApp bubble size
    full_message = f"{header}\n```\n{body}\n```"
    if len(full_message) > max_length:
        overhead = len(header) + 80
        allowed_body = max_length - overhead
        truncated_body = body[:allowed_body] + f"\n\n... [Output truncated. Total: {len(body)} chars]"
        return f"{header}\n```\n{truncated_body}\n```"

    return full_message


def format_tool_responses(responses: List[Dict[str, Any]], max_length: int = MAX_WHATSAPP_RESPONSE_LEN) -> str:
    """Format one or more execution results for WhatsApp."""
    if not responses:
        return "[Jarvis Tool Response: None]"

    if len(responses) == 1:
        return format_tool_response(responses[0], max_length=max_length)

    total = len(responses)
    parts = []
    per_item_max = max(800, max_length // total)
    for i, resp in enumerate(responses, 1):
        tool = resp.get("tool", "unknown")
        status = resp.get("status", "unknown")
        header = f"[Jarvis Tool Response {i}/{total}: {tool} | status: {status}]"
        parts.append(format_tool_response(resp, max_length=per_item_max, prefix_header=header))

    combined = "\n\n".join(parts)
    if len(combined) > max_length:
        combined = combined[:max_length - 40] + "\n... [Output truncated]"
    return combined

