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
    else:
        # Standard formats: {"tool": ..., "args": ...} or {"name": ..., "arguments": ...}
        tool = obj.get("tool") or obj.get("name")
        raw_args = obj.get("args") if "args" in obj else obj.get("arguments", obj.get("parameters", {}))

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
    seen = set()

    def add_candidate(cand: Any):
        if isinstance(cand, list):
            for item in cand:
                norm = _normalize_call(item)
                if norm:
                    key = json.dumps(norm, sort_keys=True)
                    if key not in seen:
                        seen.add(key)
                        calls.append(norm)
        elif isinstance(cand, dict):
            norm = _normalize_call(cand)
            if norm:
                key = json.dumps(norm, sort_keys=True)
                if key not in seen:
                    seen.add(key)
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


def execute_tool_call(harness: Harness, call: Dict[str, Any]) -> Dict[str, Any]:
    """Execute a parsed tool call using the harness.

    Returns a standardized dictionary:
    {"status": "ok" | "error", "tool": name, "result": ..., "error": ...}
    """
    tool = str(call.get("tool", "")).strip().lower()
    args = call.get("args", {})
    if not isinstance(args, dict):
        args = {}

    try:
        if tool == "bash":
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
            path = args.get("path")
            content = args.get("content")
            if not path or content is None:
                raise ValueError("Missing 'path' or 'content' argument for write tool")
            res = harness.write(path=path, content=content)
            return {"status": "ok", "tool": tool, "result": res}

        elif tool == "edit":
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
            pattern = args.get("pattern")
            if not pattern:
                raise ValueError("Missing 'pattern' argument for glob tool")
            res = harness.glob(pattern=pattern, path=args.get("path", "."))
            return {"status": "ok", "tool": tool, "result": res}

        elif tool == "applescript":
            script = args.get("script")
            if not script:
                raise ValueError("Missing 'script' argument for applescript tool")
            output = harness.applescript(script=script)
            return {"status": "ok", "tool": tool, "result": {"output": output}}

        elif tool == "system_info":
            res = harness.system_info()
            return {"status": "ok", "tool": tool, "result": res}

        elif tool == "instructions":
            res = harness.instructions(directory=args.get("directory"))
            return {"status": "ok", "tool": tool, "result": res}

        elif tool == "system_prompt":
            res = harness.system_prompt(
                model=args.get("model", "default"),
                agent=args.get("agent"),
            )
            return {"status": "ok", "tool": tool, "result": res}

        else:
            raise ValueError(f"Unknown harness tool: '{tool}'")

    except HarnessError as err:
        logger.warning("Harness execution error for tool '%s': %s", tool, err)
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

    elif tool in ("system_info", "instructions", "system_prompt"):
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

