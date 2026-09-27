"""Opt-in, fail-closed WhatsApp Desktop AX voice-note playback.

Requires local calibration of the selected chat, incoming direction, and the
voice-note play/pause control. Never speaks text or reads notifications.
"""
import hashlib
import json
import os
import re
import time
import logging
import threading
from pathlib import Path
from .diagnostics import event
from .ax import snapshot, verify_header, press_button
from .dispatcher import parse_tool_calls, execute_tool_call, format_tool_responses

# Invisible characters WhatsApp rendering inserts (LRM/RLM, zero-width, BOM).
_INVISIBLE_CHARS = ("\u200b", "\u200c", "\u200d", "\u200e", "\u200f", "\u2060", "\ufeff")

# Suffix in AXDescription matching timestamp and/or direction metadata:
# Examples:
#   ", 10:50 AM, Received from + 1,6 5 0,8 7 0,2 8 9 2"
#   ", 14:35, Received from + 1,6 5 0,8 7 0,2 8 9 2"
#   ", yesterday at 10:50 AM, Received from ..."
#   ", 10:50 AM" (truncated description without sender info)
_DESC_TIMESTAMP_METADATA_RE = re.compile(
    r",\s*([^,]+?)\s*,\s*(?:\u200e)?(?:Received from|Sent to|Read|Delivered)\b.*$",
    re.IGNORECASE,
)
_DESC_TIMESTAMP_FALLBACK_RE = re.compile(
    r",\s*(\d{1,2}:\d{2}(?:\s*[AP]M)?)\s*$",
    re.IGNORECASE,
)


def _strip_invisible(text):
    for ch in _INVISIBLE_CHARS:
        text = text.replace(ch, "")
    return text.replace("\u00a0", " ")


def _body_from_description(desc):
    """Extract the message body from a WhatsApp AXDescription string.

    WhatsApp Desktop (≥2.26) renders each message as a flat AXStaticText node
    whose AXDescription has the format:
        ‎message, <BODY>, <HH:MM> <AM/PM>, ‎Received from <NUMBER>
        ‎Your message, <BODY>, <HH:MM> <AM/PM>, ‎Sent to <NUMBER>, ‎Delivered

    Returns the body text, or '' if the description doesn't match.
    """
    clean = _strip_invisible(desc).strip()
    if not clean:
        return ""

    # Incoming text: starts with "message, " (NOT "Your message")
    lc = clean.lower()
    if lc.startswith("your ") or lc.startswith("voice message"):
        return ""
    prefix = ""
    if lc.startswith("message, "):
        prefix = clean[:len("message, ")]
    elif lc.startswith("document, "):
        # Incoming document descriptions - don't extract body (filename, not text)
        return ""
    else:
        return ""

    rest = clean[len(prefix):]
    # Strip trailing timestamp + direction suffix
    m = _DESC_TIMESTAMP_METADATA_RE.search(rest)
    if not m:
        m = _DESC_TIMESTAMP_FALLBACK_RE.search(rest)
    if m:
        body = rest[:m.start()].strip()
    else:
        # Description was truncated at 1500 chars; take everything after prefix.
        # This is safe because we already confirmed it's an incoming text message.
        body = rest.strip()
    return body


def _timestamp_from_description(desc):
    """Extract the message timestamp from an AXDescription string.

    Returns a normalised time string like '10:50 AM' or '14:35', or '' if none found.
    """
    clean = _strip_invisible(desc).strip()
    m = _DESC_TIMESTAMP_METADATA_RE.search(clean)
    if m:
        return re.sub(r"\s+", " ", m.group(1)).strip()
    m2 = _DESC_TIMESTAMP_FALLBACK_RE.search(clean)
    if m2:
        return re.sub(r"\s+", " ", m2.group(1)).strip()
    return ""


def _text_signature(body_text, desc, occurrence=0):
    """Build a position-independent, status-independent message signature.

    Combines the body content hash with the message timestamp extracted from
    the AXDescription, plus an occurrence index within the scan.
    - Two different messages with identical text sent at different times
      produce distinct signatures (different timestamps).
    - Two different messages with identical text sent at the same minute
      produce distinct signatures (different occurrence indices).
    - A message moving in the AX tree (due to scrolling or new bubbles)
      retains the exact same signature.
    """
    text_hash = hashlib.sha256(body_text.encode("utf-8")).hexdigest()[:16]
    ts = _timestamp_from_description(desc)
    return f"txt:{text_hash}:{ts}:{occurrence}"


# ---------------------------------------------------------------------------
# Persistent ledger: remember processed tool-call hashes across restarts
# ---------------------------------------------------------------------------
_DEFAULT_LEDGER_PATH = Path(
    os.getenv("BRIDGE_LEDGER_FILE",
              os.path.expanduser("~/Library/Logs/jarvis-bridge/processed.jsonl"))
)


class ProcessedLedger:
    """Append-only set of processed text signatures, backed by a JSONL file.

    Each line is a JSON object: {"sig": "<signature>", "time": "<ISO timestamp>"}.
    On load, all existing signatures are read into an in-memory set.
    On add, a new line is appended immediately and the set is updated.
    Pass path=":memory:" to disable disk persistence (useful in tests).
    """

    def __init__(self, path=None):
        self._path = None if path == ":memory:" else (Path(path) if path else _DEFAULT_LEDGER_PATH)
        self._sigs: set[str] = set()
        self._load()

    def _load(self):
        if not self._path or not self._path.exists():
            return
        try:
            with open(self._path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        obj = json.loads(line)
                        sig = obj.get("sig", "")
                        if sig:
                            self._sigs.add(sig)
                    except (json.JSONDecodeError, TypeError):
                        pass
        except OSError:
            pass

    def __contains__(self, sig: str) -> bool:
        return sig in self._sigs

    def add(self, sig: str):
        if sig in self._sigs:
            return
        self._sigs.add(sig)
        if not self._path:
            return
        try:
            self._path.parent.mkdir(parents=True, exist_ok=True)
            from datetime import datetime, timezone
            entry = json.dumps({"sig": sig, "time": datetime.now(timezone.utc).isoformat()})
            with open(self._path, "a", encoding="utf-8") as f:
                f.write(entry + "\n")
        except OSError as exc:
            logging.getLogger("jarvis.watcher").warning("Ledger write failed: %s", exc)

    def __len__(self):
        return len(self._sigs)


def _group_sample(descendants, group, limit=120):
    """Short repr of a group's visible text for diagnostics."""
    for r in descendants:
        v = _strip_invisible(r.get("value") or "").strip()
        if v:
            return repr(v[:limit])
    # WhatsApp 2.26+: body is in description, not value
    for r in descendants:
        body = _body_from_description(r.get("description", ""))
        if body:
            return repr(body[:limit])
    v = _strip_invisible(group.get("value") or "").strip()
    return repr(v[:limit]) if v else ""


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


def incoming_texts(rows, cfg):
    """Extract incoming text messages from the calibrated chat message list.

    Returns a list of tuples: (group_path, message_text, signature)
    Only considers groups matching incoming direction and not containing 'your message' or 'outgoing' in metadata.
    Ignores messages starting with '[Jarvis Tool Response:' to avoid echo loops.
    """
    if not cfg.message_list_path:
        return []
    parents = [r for r in rows if r.get("path") == cfg.message_list_path and r.get("role") in ("AXList", "AXScrollArea", "AXGroup")]
    if len(parents) != 1:
        event("text_scan_unavailable", level="warning", reason="list_missing_or_ambiguous", matches=len(parents))
        return []
    children = [r for r in rows if under(r.get("path", ""), cfg.message_list_path)]
    groups = [r for r in children if r.get("path", "").count("/") == cfg.message_list_path.count("/") + 1]
    event("text_scan", level="debug", groups=len(groups))
    result = []
    skipped = []
    target_num = "".join(c for c in (cfg.number or "") if c.isdigit())
    marker = (cfg.incoming_marker or "").strip().lower()
    sig_counts = {}

    for group in groups:
        grp_path = group.get("path", "")
        descendants = [r for r in children if under(r.get("path", ""), grp_path) or r.get("path") == grp_path]
        metadata = [r for r in descendants if r.get("role") != "AXStaticText"]
        if not metadata:
            metadata = descendants
        meta_label = " ".join(_strip_invisible(r.get("title", "") + " " + r.get("description", "")).lower() for r in metadata)

        # Skip outgoing messages (check both metadata label and group description)
        grp_desc_clean = _strip_invisible(group.get("description", "")).lower()
        if any(out in meta_label for out in ("your message", "outgoing", "you:")) or grp_desc_clean.startswith("your "):
            if "jarvis_call" in meta_label or "jarvis_call" in grp_desc_clean or any("jarvis_call" in _strip_invisible(r.get("value") or "").casefold() for r in descendants):
                event("text_group_skip", level="warning", reason="outgoing_filter", meta=meta_label[:120], sample=_group_sample(descendants, group))
            skipped.append(("outgoing_filter", _group_sample(descendants, group)))
            continue

        # Check for incoming direction
        is_incoming = False
        if marker and marker in meta_label:
            is_incoming = True
        elif "incoming" in meta_label:
            is_incoming = True
        elif "received from" in meta_label or "received from" in grp_desc_clean:
            is_incoming = True
        elif target_num and target_num in "".join(c for c in meta_label if c.isdigit()):
            is_incoming = True
        # WhatsApp 2.26+ flat nodes: incoming text starts with "message, "
        # (not "Your message") and has no "Sent to" suffix.
        elif grp_desc_clean.startswith("message, ") and "sent to" not in grp_desc_clean:
            is_incoming = True
        elif not cfg.safe_mode:
            is_incoming = True

        if not is_incoming:
            if any("jarvis_call" in _strip_invisible(r.get("value") or "").casefold() for r in descendants) or "jarvis_call" in grp_desc_clean:
                event("text_group_skip", level="warning", reason="direction_filter", meta=meta_label[:120], sample=_group_sample(descendants, group))
            skipped.append(("not_incoming", _group_sample(descendants, group)))
            continue

        # --- Body text extraction ---
        # Strategy 1: child AXStaticText/AXTextArea/AXLink nodes with value or title
        text_nodes = [r for r in descendants if r.get("role") in ("AXStaticText", "AXTextArea", "AXLink")]
        body_parts = []
        for r in text_nodes:
            val = _strip_invisible(r.get("value") or "").strip()
            title = _strip_invisible(r.get("title") or "").strip()
            chunk = val or title
            if chunk:
                body_parts.append(chunk)

        # Strategy 2: group's AXValue (some older WhatsApp builds)
        if not body_parts:
            val = _strip_invisible(group.get("value") or "").strip()
            if "JARVIS_CALL:" in val:
                body_parts.append(val)

        # Strategy 3: AXDescription-based extraction (WhatsApp 2.26+ flat nodes).
        # The description holds everything: "message, <body>, <time>, Received from ..."
        if not body_parts:
            for r in descendants:
                desc_body = _body_from_description(r.get("description", ""))
                if desc_body:
                    body_parts.append(desc_body)
                    break  # one body per group

        if not body_parts:
            sample = _group_sample(descendants, group)
            if sample:
                skipped.append(("no_body", sample))
            continue

        full_text = "\n".join(body_parts).strip()
        if not full_text:
            continue

        # Prevent loop: never process our own tool response
        if full_text.startswith("[Jarvis Tool Response:"):
            skipped.append(("echo_guard", repr(full_text[:100])))
            continue

        group_desc = group.get("description", "")
        ts = _timestamp_from_description(group_desc)
        text_hash = hashlib.sha256(full_text.encode("utf-8")).hexdigest()[:16]
        occ = sig_counts.get((text_hash, ts), 0)
        sig_counts[(text_hash, ts)] = occ + 1
        sig = f"txt:{text_hash}:{ts}:{occ}"
        result.append((grp_path, full_text, sig))

    if not result and skipped:
        event("text_scan_skipped", level="debug", samples=[f"{reason}: {sample}" for reason, sample in skipped[:4] if sample])
    return result


def _label(row):
    return " ".join(row.get(k, "") for k in ("title", "description", "value")).strip().casefold()


def voice_groups(rows, cfg, include_playing=False):
    """Return ordered (group path, play-button path) pairs; text groups are skipped.

    Markers must be on non-body AX metadata. A single exact play control is
    required per group. Ambiguous audio controls stop the watcher.
    When include_playing is False, active pause controls (currently playing audio) are skipped.
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
            if not include_playing and pauses and not controls:
                # Active pause button: audio is currently playing in this group; do not queue.
                continue
            result.append((group["path"], (controls or pauses)[0]["path"]))
    return result


def parse_duration(desc):
    """Read the voice-note total, including WhatsApp's 0:09 / 1:02 display."""
    m_min = re.search(r"(\d+)\s*minute", desc, re.IGNORECASE)
    m_sec = re.search(r"(\d+)\s*second", desc, re.IGNORECASE)
    if m_min or m_sec:
        return (int(m_min.group(1)) if m_min else 0) * 60 + (int(m_sec.group(1)) if m_sec else 0)
    clock = re.findall(r"(?<!\d)(\d{1,2}):(\d{2})(?!\d)", desc)
    if clock:
        minutes, seconds = clock[-1]  # "0:03 of 0:09": use the total.
        return int(minutes) * 60 + int(seconds)
    return 0  # Unknown duration: wait for a real pause-to-play transition.


def voice_signature(row):
    desc = " ".join(row.get(k, "") for k in ("title", "description", "value"))
    cleaned = re.sub(r'[\u200e,\s]+(Listened|Unplayed|Delivered|Played)', '', desc, flags=re.IGNORECASE)
    # Drop live play progress ("0:03 of 0:15") so the signature is stable
    # while a note plays; the total duration after "of" is kept.
    cleaned = re.sub(r'\d+:\d{2}\s+of\s+', '', cleaned)
    cleaned = cleaned.strip()
    return cleaned or row.get("path", "")


def canonical_voice_signature(ctrl, group=None, cfg=None):
    """Build a stable, position-independent signature for an incoming voice note.

    Combines the group timestamp with the audio duration so the signature
    remains completely invariant whether the note is unplayed, playing, or played.
    """
    desc = " ".join(ctrl.get(k, "") for k in ("title", "description", "value"))
    dur = parse_duration(desc)
    grp_desc = group.get("description", "") if isinstance(group, dict) else ""
    ts = _timestamp_from_description(grp_desc)
    
    cleaned = re.sub(r'[\u200e,\s]+(Listened|Unplayed|Delivered|Played)', '', desc, flags=re.IGNORECASE)
    cleaned = re.sub(r'\d+:\d{2}\s*(?:of|/)\s*', '', cleaned)
    if cfg:
        if cfg.voice_play_marker:
            cleaned = re.sub(re.escape(cfg.voice_play_marker), '', cleaned, flags=re.IGNORECASE)
        if cfg.voice_pause_marker:
            cleaned = re.sub(re.escape(cfg.voice_pause_marker), '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'\b(play|pause)\b(?:\s+voice\s+message)?', '', cleaned, flags=re.IGNORECASE).strip()

    if ts and dur:
        return f"voice:{ts}:{dur}s"
    if dur:
        return f"voice:{dur}s:{cleaned}"
    if ts:
        return f"voice:{ts}:{cleaned}"
    return f"voice:{cleaned}" if cleaned else ctrl.get("path", "")


def resolve_voice_control(rows, cfg, target_sig, fallback_path=None):
    """Dynamically resolve the current play button path for a voice note signature from fresh rows.

    Prevents stale AX path errors when new message bubbles shift list indices.
    """
    try:
        groups = voice_groups(rows, cfg, include_playing=True)
        row_map = {r["path"]: r for r in rows}
        for grp_path, ctrl_path in groups:
            ctrl = row_map.get(ctrl_path)
            grp = row_map.get(grp_path)
            if ctrl:
                if voice_signature(ctrl) == target_sig:
                    return ctrl_path
                if canonical_voice_signature(ctrl, grp, cfg) == target_sig:
                    return ctrl_path
    except Exception:
        pass
    return fallback_path


def pause_active_playback(rows, cfg, press=press_button):
    """Find any actively playing voice control (Pause state) and press it to stop playback immediately."""
    if not cfg.voice_pause_marker or not cfg.message_list_path:
        return False
    pause_marker = cfg.voice_pause_marker.casefold()
    for r in rows:
        if under(r.get("path", ""), cfg.message_list_path) and r.get("role") in ("AXButton", "AXStaticText"):
            if pause_marker in _label(r):
                try:
                    press(r["path"], expected_label=cfg.voice_pause_marker)
                    event("echo_guard", state="playback_paused_by_signal")
                    return True
                except Exception:
                    pass
    return False


def _wait_for_completion(cfg, button_path, dur, stop, get_snapshot, user_recording=None, press=press_button):
    """Hold the mic guard until playback ends, never on a stale Play label.

    AX may lag and show Play while the note is audible. If duration is known,
    preserve the guard for at least that long; if the path disappears, wait
    out the duration. If user_recording becomes active, immediately pauses playback
    and exits wait so user speech is never contaminated or dropped.
    """
    play = cfg.voice_play_marker.casefold()
    pause = cfg.voice_pause_marker.casefold()
    started = time.monotonic()
    cap = max(10.0, float(cfg.max_voice_seconds or 300))
    minimum = float(dur) + 0.8 if dur else 0.0
    wait_end = started + min(cap, (float(dur) + 3.0) if dur else min(cap, 25.0))
    saw_pause = False
    while time.monotonic() < wait_end:
        if stop is not None and stop.is_set():
            return
        if user_recording is not None and user_recording.is_set():
            event("echo_guard", state="interrupted_by_user_recording", elapsed_s=round(time.monotonic() - started, 2))
            try:
                try:
                    rows = get_snapshot(safe_mode=cfg.safe_mode)
                except TypeError:
                    rows = get_snapshot()
                pause_active_playback(rows, cfg, press=press)
            except Exception:
                pass
            return
        ctrl = None
        rows = []
        try:
            try:
                rows = get_snapshot(safe_mode=cfg.safe_mode)
            except TypeError:
                rows = get_snapshot()
            ctrl = next((r for r in rows if r["path"] == button_path), None)
        except Exception:
            pass

        # Check if pause marker is visible anywhere in the message list
        has_active_pause = False
        if rows:
            has_active_pause = any(
                pause in _label(r)
                for r in rows
                if under(r.get("path", ""), cfg.message_list_path) and r.get("role") in ("AXButton", "AXStaticText")
            )

        if ctrl is not None:
            lab = _label(ctrl)
            if pause in lab:
                saw_pause = True
            elif play in lab and saw_pause and time.monotonic() - started >= minimum:
                event("echo_guard", state="playback_completed", elapsed_s=round(time.monotonic() - started, 2), duration_s=dur)
                return
        elif has_active_pause:
            saw_pause = True
        elif saw_pause and time.monotonic() - started >= minimum:
            event("echo_guard", state="playback_completed", elapsed_s=round(time.monotonic() - started, 2), duration_s=dur)
            return

        # If audio duration is known and has elapsed + 1.2s, and no pause control is active anywhere, complete!
        if dur and time.monotonic() - started >= dur + 1.2 and not has_active_pause:
            event("echo_guard", state="playback_duration_elapsed", elapsed_s=round(time.monotonic() - started, 2), duration_s=dur)
            return

        if stop is not None:
            stop.wait(0.3)
        else:
            time.sleep(0.3)
    event("echo_guard", state="playback_wait_expired", level="warning", elapsed_s=round(time.monotonic() - started, 2), duration_s=dur, saw_pause=saw_pause)


def watch(cfg, timeout=None, stop=None, get_snapshot=snapshot, press=press_button, state=None, pause=None, desk=None, harness=None, playing=None, ledger_path=None, user_recording=None):
    """Play new inbound notes and/or dispatch incoming tool calls over WhatsApp.

    WhatsApp remains completely hidden in the background while running.
    Pass a shared state dict across calls so processed signatures and the queue
    survive between watch windows and messages are not re-baselined away.
    """
    deadline = time.monotonic() + (timeout or cfg.reply_timeout)
    def checked():
        try:
            rows = get_snapshot(safe_mode=cfg.safe_mode)
        except TypeError:
            rows = get_snapshot()
        verify_header(rows, cfg.number, cfg.header_path, safe_mode=cfg.safe_mode)
        return rows

    initial_rows = None
    def get_initial():
        nonlocal initial_rows
        if initial_rows is None:
            initial_rows = checked()
        return initial_rows

    if state is None:
        state = {}
    target_path = ledger_path or getattr(cfg, "ledger_path", None)

    played_signatures = state.get("played")
    if played_signatures is None:
        # First window only: index existing voice notes so old history is not replayed
        played_signatures = ProcessedLedger(path=target_path) if target_path else set()
        try:
            init = get_initial()
            row_map = {r["path"]: r for r in init}
            initial_voice = voice_groups(init, cfg, include_playing=True)
            for grp_path, ctrl_path in initial_voice:
                ctrl = row_map.get(ctrl_path)
                grp = row_map.get(grp_path)
                if ctrl:
                    played_signatures.add(voice_signature(ctrl))
                    played_signatures.add(canonical_voice_signature(ctrl, grp, cfg))
            event("voice_baseline", count=len(initial_voice), ledger_total=len(played_signatures))
        except Exception as v_exc:
            logging.getLogger("jarvis.watcher").warning("Voice baseline deferred: %s", v_exc)
        state["played"] = played_signatures

    processed_texts = state.get("processed_texts")
    if processed_texts is None:
        # First window: load persistent ledger (survives restarts) and baseline
        # any visible incoming text messages so chat history is never re-executed.
        processed_texts = ProcessedLedger(path=target_path)
        try:
            init = get_initial()
            baselined = 0
            for grp_path, text, sig in incoming_texts(init, cfg):
                processed_texts.add(sig)
                baselined += 1
            event("text_baseline", count=baselined, ledger_total=len(processed_texts))
        except Exception:
            logging.getLogger("jarvis.watcher").exception("Text baseline failed; watcher must not replay history")
            raise
        state["processed_texts"] = processed_texts

    queue = state.setdefault("queue", [])
    fail_counts = state.setdefault("fails", {})
    playback_active = threading.Event()
    playback_stop = threading.Event()

    def process_playback():
        """Dedicated background playback worker: plays voice notes without blocking the tool watcher."""
        while not (stop is not None and stop.is_set()) and not playback_stop.is_set():
            if not queue:
                if stop is not None: stop.wait(0.2)
                else: time.sleep(0.2)
                continue

            # Hold playback while user is recording or sending
            is_user_active = (user_recording is not None and user_recording.is_set()) or (pause is not None and pause.is_set())
            if is_user_active:
                event("playback_hold", reason="user_recording_or_sending", queued=len(queue))
                if stop is not None: stop.wait(0.2)
                else: time.sleep(0.2)
                continue

            try:
                sig, button_path, dur = queue.pop(0)
            except IndexError:
                continue

            playback_active.set()
            if playing is not None:
                playing.set()
                event("echo_guard", state="playback_started", duration_s=dur)

            try:
                try:
                    fresh_rows = checked()
                except Exception:
                    fresh_rows = []
                target_path = resolve_voice_control(fresh_rows, cfg, sig, fallback_path=button_path) if fresh_rows else button_path

                press(target_path, expected_label=cfg.voice_play_marker)
                fail_counts.pop(sig, None)
                _wait_for_completion(cfg, target_path, dur, stop, get_snapshot, user_recording=user_recording, press=press)
                print("[Voice note playback finished]")
            except Exception as exc:
                fail_counts[sig] = fail_counts.get(sig, 0) + 1
                print(f"Playback trigger failed for {button_path} (attempt {fail_counts[sig]}/3): {exc}")
                if fail_counts[sig] >= 3:
                    print(f"Skipping voice note after 3 failed play attempts: {sig[:80]}")
            finally:
                if playing is not None:
                    if stop is not None: stop.wait(1.5)
                    else: time.sleep(1.5)
                    playing.clear()
                    event("echo_guard", state="cooldown_complete", seconds=1.5)
                playback_active.clear()

    playback_thread = threading.Thread(target=process_playback, daemon=True, name="jarvis-voice-playback")
    playback_thread.start()

    warned_missing = False
    poll_interval = 0.35
    try:
        while (time.monotonic() < deadline or queue or playback_active.is_set()) and (stop is None or not stop.is_set()):
            if stop is not None and stop.wait(poll_interval):
                return
            if stop is None:
                time.sleep(poll_interval)

            try:
                rows = checked()
            except Exception as exc:
                # If safe mode and not a temporary send/attach transition, raise
                if cfg.safe_mode and not ((pause is not None and pause.is_set()) or (user_recording is not None and user_recording.is_set())):
                    raise
                continue

            row_map = {r["path"]: r for r in rows}

            # 1. Voice reply check (detect new notes and add to queue)
            if cfg.voice_play_marker and cfg.voice_pause_marker:
                try:
                    current_groups = voice_groups(rows, cfg, include_playing=False)
                    warned_missing = False
                    for grp_path, ctrl_path in current_groups:
                        ctrl = row_map.get(ctrl_path)
                        grp = row_map.get(grp_path)
                        if not ctrl: continue
                        sig = voice_signature(ctrl)
                        canon_sig = canonical_voice_signature(ctrl, grp, cfg)
                        if sig in played_signatures or canon_sig in played_signatures or any(q[0] in (sig, canon_sig) for q in queue):
                            continue

                        dur = parse_duration(ctrl.get("description", "") + " " + ctrl.get("title", ""))
                        queue.append((sig, ctrl_path, dur))
                        # Immediately mark as played so it can NEVER be queued again!
                        played_signatures.add(sig)
                        played_signatures.add(canon_sig)
                        event("voice_note_queued", duration_s=dur)
                        is_user_busy = (user_recording is not None and user_recording.is_set()) or (pause is not None and pause.is_set())
                        if is_user_busy:
                            print(f"\n[Incoming voice note detected] Duration: ~{dur}s | Held (waiting for your voice message to send)...")
                        else:
                            print(f"\n[Incoming voice note detected] Duration: ~{dur}s | Queued for background playback...")
                except Exception as exc:
                    if cfg.safe_mode:
                        raise
                    if "Message list path missing or ambiguous" in str(exc):
                        if not warned_missing:
                            print("Voice scan unavailable: calibrated BRIDGE_MESSAGE_LIST_PATH is not visible.")
                            warned_missing = True
                    else:
                        print(f"Voice scan paused (unlocked mode): {exc}")

            # 2. Text tool call check (FAST: executes and responds immediately!)
            if desk is not None and harness is not None:
                try:
                    current_texts = incoming_texts(rows, cfg)
                    for grp_path, msg_text, sig in current_texts:
                        if sig in processed_texts:
                            continue
                        processed_texts.add(sig)

                        tool_calls = parse_tool_calls(msg_text)
                        if not tool_calls:
                            continue
                        event("tool_dispatch", calls=len(tool_calls), tools=[c.get("tool") for c in tool_calls])

                        print(f"\n[Incoming tool call detected from Jarvis ({len(tool_calls)} call{'s' if len(tool_calls) > 1 else ''})]")
                        t_start = time.monotonic()
                        responses = []
                        for call in tool_calls:
                            t_name = call.get("tool", "unknown")
                            res = execute_tool_call(harness, call)
                            responses.append(res)
                        t_exec = time.monotonic() - t_start

                        reply_text = format_tool_responses(responses)

                        # Wait briefly if user is actively recording or sending audio
                        wait_send_start = time.monotonic()
                        while (user_recording is not None and user_recording.is_set()) or (pause is not None and pause.is_set()):
                            if stop is not None and stop.is_set():
                                break
                            if time.monotonic() - wait_send_start > 30.0:
                                break
                            time.sleep(0.1)

                        t_send_start = time.monotonic()
                        desk.send_tool_response(reply_text)
                        t_total = time.monotonic() - t_start
                        event("tool_response_sent", calls=len(tool_calls), exec_s=round(t_exec, 3), total_s=round(t_total, 3))
                        print(f"[Tool response sent in {t_total:.2f}s (exec: {t_exec:.2f}s)]")
                except Exception as exc:
                    print(f"[Tool dispatch error] {exc}")
                    logging.getLogger("jarvis.watcher").exception("Tool dispatch failed")
    finally:
        playback_stop.set()
        if playback_thread.is_alive():
            playback_thread.join(timeout=0.5)

