"""Privacy-aware JSON-lines diagnostics. Never write chat bodies, scripts, or audio."""
import json
import logging
import os
from logging.handlers import RotatingFileHandler
from pathlib import Path

LOGGER = logging.getLogger("openagent")


def setup_logging(verbose=False):
    path = Path(os.getenv("BRIDGE_LOG_FILE", "~/Library/Logs/OpenAgent/bridge.jsonl")).expanduser()
    path.parent.mkdir(parents=True, exist_ok=True)
    LOGGER.setLevel(logging.DEBUG if verbose else logging.INFO)
    LOGGER.handlers.clear()
    file_handler = RotatingFileHandler(path, maxBytes=2_000_000, backupCount=3, encoding="utf-8")
    file_handler.setFormatter(logging.Formatter("%(message)s"))
    LOGGER.addHandler(file_handler)
    if verbose:
        console = logging.StreamHandler()
        console.setFormatter(logging.Formatter("%(message)s"))
        LOGGER.addHandler(console)
    event("bridge_start", verbose=verbose, log_file=str(path))
    print(f"Diagnostics: {path}" + (" (--verbose enabled)" if verbose else ""))
    return path


def event(name, level="info", **fields):
    from datetime import datetime, timezone
    safe = {key: value for key, value in fields.items() if key not in {"text", "body", "script", "audio", "args"}}
    payload = {"time": datetime.now(timezone.utc).isoformat(), "event": name, **safe}
    getattr(LOGGER, level)(json.dumps(payload, ensure_ascii=False, default=str))
    try:
        from .sound import SoundEvent, play as play_sound
        play_sound(SoundEvent.LOG_EVENT)
    except Exception:
        pass
