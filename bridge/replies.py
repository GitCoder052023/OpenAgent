"""Conservative Accessibility watcher: only calibrated incoming bubbles in selected chat.

The row path is to the message list and the marker must be a non-body AX label
on each incoming message group. If WhatsApp does not expose direction, stop.
"""
import time
from .ax import snapshot, verify_header


def under(path, parent): return path.startswith(parent + "/")


def incoming(rows, list_path, marker):
    if not list_path or not marker or len(marker) < 3:
        raise RuntimeError("Reply list path and incoming direction marker must be calibrated")
    parents = [r for r in rows if r["path"] == list_path and r["role"] in ("AXList", "AXScrollArea", "AXGroup")]
    if len(parents) != 1: raise RuntimeError("Message list path missing or ambiguous")
    children = [r for r in rows if under(r["path"], list_path)]
    groups = [r for r in children if r["path"].count("/") == list_path.count("/") + 1]
    result = []
    for group in groups:
        descendants = [r for r in children if under(r["path"], group["path"]) or r["path"] == group["path"]]
        labels = [(r["title"] + " " + r["description"]).lower() for r in descendants]
        if not any(marker.lower() in label for label in labels): continue
        texts = [r["value"].strip() for r in descendants
                 if r["role"] == "AXStaticText" and r["value"].strip()]
        # UI-specific, inspect before trusting. Never speak content from a non-marked group.
        if texts: result.append((group["path"], " ".join(texts)[:1200]))
    return result


def watch(cfg, speak, timeout=None):
    """Start from current visible messages, then speak newly appended incoming groups.

    Aborts on any chat mismatch. Snapshots must retain stable paths; changed layout
    may cause duplicates, so do not leave unattended.
    """
    deadline = time.monotonic() + (timeout or cfg.reply_timeout)
    rows = snapshot()
    verify_header(rows, cfg.number, cfg.header_path)
    previous = incoming(rows, cfg.message_list_path, cfg.incoming_marker)
    while time.monotonic() < deadline:
        time.sleep(1)
        rows = snapshot()
        verify_header(rows, cfg.number, cfg.header_path)
        current = incoming(rows, cfg.message_list_path, cfg.incoming_marker)
        if len(current) < len(previous):
            raise RuntimeError("Message list changed/virtualized; stopping reply watch")
        # If the visible prefix changed, we cannot prove which message is new.
        if current[:len(previous)] != previous:
            raise RuntimeError("Message list reordered; stopping reply watch")
        for _, text in current[len(previous):]:
            verify_header(snapshot(), cfg.number, cfg.header_path)
            speak(text)
        previous = current
