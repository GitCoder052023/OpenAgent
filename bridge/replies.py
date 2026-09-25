"""Opt-in, fail-closed WhatsApp Desktop AX voice-note playback.

Requires local calibration of the selected chat, incoming direction, and the
voice-note play/pause control. Never speaks text or reads notifications.
"""
import time
from .ax import snapshot, verify_header, press_button


def under(path, parent):
    return path.startswith(parent + "/")


def incoming(rows, list_path, marker):
    """Return incoming direct-child groups in visual AX order, including text.

    This legacy helper is retained for inspection/tests; watch() never speaks it.
    """
    if not list_path or not marker or len(marker) < 3:
        raise RuntimeError("Reply list path and incoming direction marker must be calibrated")
    parents = [r for r in rows if r["path"] == list_path and r["role"] in ("AXList", "AXScrollArea", "AXGroup")]
    if len(parents) != 1:
        raise RuntimeError("Message list path missing or ambiguous")
    children = [r for r in rows if under(r["path"], list_path)]
    groups = [r for r in children if r["path"].count("/") == list_path.count("/") + 1]
    result = []
    for group in groups:
        descendants = [r for r in children if under(r["path"], group["path"]) or r["path"] == group["path"]]
        labels = [(r["title"] + " " + r["description"]).lower() for r in descendants]
        if not any(marker.lower() in label for label in labels):
            continue
        texts = [r["value"].strip() for r in descendants if r["role"] == "AXStaticText" and r["value"].strip()]
        if texts:
            result.append((group["path"], " ".join(texts)[:1200]))
    return result


def _label(row):
    return " ".join(row.get(k, "") for k in ("title", "description", "value")).strip().casefold()


def voice_groups(rows, cfg):
    """Return ordered (group path, play-button path) pairs; text groups are skipped.

    Markers must be on non-body AX metadata. A single exact play control is
    required per group. Ambiguous audio controls stop the watcher.
    """
    if not cfg.message_list_path or len(cfg.incoming_marker) < 3 or len(cfg.voice_play_marker) < 3 or len(cfg.voice_pause_marker) < 3:
        raise RuntimeError("Incoming/voice AX markers and list path must be calibrated")
    if cfg.voice_play_marker.casefold() == cfg.voice_pause_marker.casefold():
        raise RuntimeError("Play and pause labels must differ")
    parent = [r for r in rows if r["path"] == cfg.message_list_path and r["role"] in ("AXList", "AXScrollArea", "AXGroup")]
    if len(parent) != 1:
        raise RuntimeError("Message list path missing or ambiguous")
    children = [r for r in rows if under(r["path"], cfg.message_list_path)]
    groups = [r for r in children if r["path"].count("/") == cfg.message_list_path.count("/") + 1]
    result = []
    for group in groups:
        descendants = [r for r in children if r["path"] == group["path"] or under(r["path"], group["path"])]
        metadata = [r for r in descendants if r["role"] != "AXStaticText"]
        if not metadata:
            metadata = descendants
        if not any(cfg.incoming_marker.casefold() in " ".join((r["title"], r["description"])).casefold() for r in metadata):
            continue
        if any("your" in " ".join((r["title"], r["description"])).casefold() for r in metadata):
            continue
        controls = [r for r in descendants if r["role"] in ("AXButton", "AXStaticText") and cfg.voice_play_marker.casefold() in _label(r)]
        pauses = [r for r in descendants if r["role"] in ("AXButton", "AXStaticText") and cfg.voice_pause_marker.casefold() in _label(r)]
        if controls or pauses:
            if len(controls) + len(pauses) != 1:
                raise RuntimeError("Voice control ambiguous; stopping")
            result.append((group["path"], (controls or pauses)[0]["path"]))
    return result


def _state(rows, cfg, group_path):
    descendants = [r for r in rows if r["role"] in ("AXButton", "AXStaticText") and (r["path"] == group_path or under(r["path"], group_path))]
    playing = [r for r in descendants if cfg.voice_pause_marker.casefold() in _label(r)]
    ready = [r for r in descendants if cfg.voice_play_marker.casefold() in _label(r)]
    if len(playing) + len(ready) != 1:
        raise RuntimeError("Voice control vanished or became ambiguous")
    return ("playing", playing[0]["path"]) if playing else ("ready", ready[0]["path"])


def watch(cfg, timeout=None, stop=None, get_snapshot=snapshot, press=press_button):
    """Play new inbound notes sequentially through WhatsApp's own Mac output.

    Prefix validation deliberately stops on virtualized/reordered message lists.
    If playback state cannot be observed, it stops rather than starting the
    next note over an unknown current one.
    """
    deadline = time.monotonic() + (timeout or cfg.reply_timeout)
    def checked():
        rows = get_snapshot()
        verify_header(rows, cfg.number, cfg.header_path)
        return rows
    previous = voice_groups(checked(), cfg)
    queue = []
    active = None
    active_since = None
    while time.monotonic() < deadline or active or queue:
        if stop is not None and stop.wait(1):
            return
        if stop is None:
            time.sleep(1)
        rows = checked()
        current = voice_groups(rows, cfg)
        if len(current) < len(previous) or current[:len(previous)] != previous:
            raise RuntimeError("Voice list changed/virtualized; stopping playback")
        queue.extend(path for path, _ in current[len(previous):])
        previous = current
        if active:
            if time.monotonic() - active_since > cfg.max_voice_seconds:
                raise RuntimeError("Voice playback did not finish within limit; stopping")
            state, _ = _state(rows, cfg, active)
            if state == "ready":
                active = None
                active_since = None
            else:
                continue
        if queue:
            group_path = queue.pop(0)
            state, button_path = _state(rows, cfg, group_path)
            if state != "ready":
                raise RuntimeError("Voice note already playing; stopping")
            # Verify selected chat and exact group/control in a fresh snapshot.
            rows = checked()
            if (group_path, button_path) not in voice_groups(rows, cfg) or _state(rows, cfg, group_path) != ("ready", button_path):
                raise RuntimeError("Voice control changed before playback")
            press(button_path, expected_label=cfg.voice_play_marker)
            rows = checked()
            if _state(rows, cfg, group_path)[0] != "playing":
                raise RuntimeError("Cannot verify voice note started; stopping")
            active = group_path
            active_since = time.monotonic()
