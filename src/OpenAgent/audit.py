"""Structured append-only JSONL activity audit logger for OpenAgent.

Records tool invocations, duration, arguments length, outcomes, and safety guard verdicts
so users and external tools can inspect or tail OpenAgent's activity trail.
Modeled after openagent/audit.
"""

import json
import logging
import os
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("openagent.audit")

_LOCK = threading.Lock()
_AUDIT_DIR: Optional[Path] = None


def get_audit_dir() -> Path:
    """Return the audit log directory, defaulting to ~/.openagent/audit or .openagent/audit."""
    global _AUDIT_DIR
    if _AUDIT_DIR is not None:
        return _AUDIT_DIR

    custom = os.getenv("OPENAGENT_AUDIT_DIR")
    if custom:
        path = Path(custom).expanduser().resolve()
    else:
        # Prefer repo-local .openagent/audit if in workspace, else user home
        local_dir = Path.cwd() / ".openagent" / "audit"
        if local_dir.parent.exists():
            path = local_dir
        else:
            path = Path.home() / ".openagent" / "audit"

    path.mkdir(parents=True, exist_ok=True)
    _AUDIT_DIR = path
    return _AUDIT_DIR


def set_audit_dir(path: Path) -> None:
    global _AUDIT_DIR
    _AUDIT_DIR = path.resolve()
    _AUDIT_DIR.mkdir(parents=True, exist_ok=True)


def _get_current_log_file() -> Path:
    audit_dir = get_audit_dir()
    date_str = datetime.now(timezone.utc).strftime("%Y%m%d")
    return audit_dir / f"audit_{date_str}.jsonl"


def log_event(
    event_type: str,
    tool: Optional[str] = None,
    session_id: Optional[str] = None,
    arguments_length: int = 0,
    outcome: str = "ok",
    duration_ms: float = 0.0,
    effect: str = "allow",
    rule: str = "",
    reason: str = "",
    error: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> None:
    """Append a structured audit event line to the JSONL log file. Never raises exceptions."""
    try:
        ts = datetime.now(timezone.utc).isoformat()
        entry: Dict[str, Any] = {
            "timestamp": ts,
            "type": event_type,
            "tool": tool,
            "sessionId": session_id or "instinct-whatsapp",
            "argumentsLength": arguments_length,
            "outcome": outcome,
            "durationMs": round(duration_ms, 2),
            "effect": effect,
        }
        if rule:
            entry["rule"] = rule
        if reason:
            entry["reason"] = reason
        if error:
            entry["error"] = str(error)[:500]
        if metadata:
            entry["metadata"] = metadata

        line = json.dumps(entry, ensure_ascii=False) + "\n"
        log_file = _get_current_log_file()

        with _LOCK:
            with open(log_file, "a", encoding="utf-8") as f:
                f.write(line)
    except Exception as exc:
        logger.debug("Failed to record audit event: %s", exc)


def get_recent_events(limit: int = 20) -> List[Dict[str, Any]]:
    """Return the most recent audit events."""
    events: List[Dict[str, Any]] = []
    log_file = _get_current_log_file()
    if not log_file.exists():
        return events

    try:
        with _LOCK:
            with open(log_file, "r", encoding="utf-8") as f:
                lines = f.readlines()
        for line in reversed(lines):
            line = line.strip()
            if not line:
                continue
            try:
                events.append(json.loads(line))
                if len(events) >= limit:
                    break
            except Exception:
                continue
    except Exception as exc:
        logger.warning("Could not read audit log: %s", exc)

    return events
