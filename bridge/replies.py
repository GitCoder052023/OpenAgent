"""Opt-in, fail-closed WhatsApp Desktop AX voice-note playback.

Requires local calibration of the selected chat, incoming direction, and the
voice-note play/pause control. Never speaks text or reads notifications.
"""
import re
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


def parse_duration(desc):
    m_min = re.search(r"(\d+)\s*minute", desc, re.IGNORECASE)
    m_sec = re.search(r"(\d+)\s*second", desc, re.IGNORECASE)
    mins = int(m_min.group(1)) if m_min else 0
    secs = int(m_sec.group(1)) if m_sec else 0
    return mins * 60 + secs if (mins or secs) else 5


def voice_signature(row):
    desc = " ".join(row.get(k, "") for k in ("title", "description", "value"))
    cleaned = re.sub(r'[\u200e,\s]+(Listened|Unplayed|Delivered|Played)', '', desc, flags=re.IGNORECASE)
    # Drop live play progress ("0:03 of 0:15") so the signature is stable
    # while a note plays; the total duration after "of" is kept.
    cleaned = re.sub(r'\d+:\d{2}\s+of\s+', '', cleaned)
    cleaned = cleaned.strip()
    return cleaned or row.get("path", "")


def _wait_for_completion(cfg, button_path, dur, stop, get_snapshot):
    """Wait until the note's control flips from pause back to play.

    Bounded by the parsed duration and cfg.max_voice_seconds. Falls back to
    the duration guess when the control path stops resolving (list
    virtualization), so a lost path can never hang the watcher.
    """
    play = cfg.voice_play_marker.casefold()
    pause = cfg.voice_pause_marker.casefold()
    cap = min(max(float(dur) + 5.0, 10.0), float(cfg.max_voice_seconds or 300))
    wait_end = time.monotonic() + cap
    start_deadline = time.monotonic() + 3.0
    path_lost = False
    saw_pause = False
    while time.monotonic() < wait_end:
        if stop is not None and stop.is_set():
            return
        if not path_lost:
            ctrl = None
            try:
                try:
                    rows = get_snapshot(safe_mode=cfg.safe_mode)
                except TypeError:
                    rows = get_snapshot()
                ctrl = next((r for r in rows if r["path"] == button_path), None)
            except Exception:
                ctrl = None
            if ctrl is None:
                path_lost = True  # list virtualized; wait out the duration guess
            else:
                lab = _label(ctrl)
                if pause in lab:
                    saw_pause = True
                elif play in lab and (saw_pause or time.monotonic() > start_deadline):
                    return  # control flipped back to play: note finished
        if stop is not None:
            stop.wait(0.5)
        else:
            time.sleep(0.5)


def watch(cfg, timeout=None, stop=None, get_snapshot=snapshot, press=press_button, state=None):
    """Play new inbound notes sequentially through WhatsApp's own Mac output.

    WhatsApp remains completely hidden in the background while notes play.
    Pass a shared state dict across calls so played signatures and the queue
    survive between watch windows and notes are not re-baselined away.
    """
    deadline = time.monotonic() + (timeout or cfg.reply_timeout)
    def checked():
        try:
            rows = get_snapshot(safe_mode=cfg.safe_mode)
        except TypeError:
            rows = get_snapshot()
        verify_header(rows, cfg.number, cfg.header_path, safe_mode=cfg.safe_mode)
        return rows

    if state is None:
        state = {}
    played_signatures = state.get("played")
    if played_signatures is None:
        # First window only: index existing voice notes so old messages are not replayed
        played_signatures = set()
        try:
            initial_rows = checked()
            initial_groups = voice_groups(initial_rows, cfg)
            row_map = {r["path"]: r for r in initial_rows}
            for grp_path, ctrl_path in initial_groups:
                ctrl = row_map.get(ctrl_path)
                if ctrl:
                    played_signatures.add(voice_signature(ctrl))
        except Exception:
            pass
        state["played"] = played_signatures
    queue = state.setdefault("queue", [])
    fail_counts = state.setdefault("fails", {})

    while (time.monotonic() < deadline or queue) and (stop is None or not stop.is_set()):
        if stop is not None and stop.wait(1):
            return
        if stop is None:
            time.sleep(1)

        try:
            rows = checked()
        except Exception as exc:
            if cfg.safe_mode:
                raise
            print(f"Snapshot check failed (unlocked mode): {exc}")
            continue

        row_map = {r["path"]: r for r in rows}
        try:
            current_groups = voice_groups(rows, cfg)
        except Exception as exc:
            if cfg.safe_mode:
                # Calibration/ambiguity errors must stop the watcher loudly,
                # not spin silently forever.
                raise
            # WhatsApp might be temporarily displaying the file attachment sheet, preview dialog, or menu.
            print(f"Voice scan paused (unlocked mode): {exc}")
            continue
        for grp_path, ctrl_path in current_groups:
            ctrl = row_map.get(ctrl_path)
            if not ctrl: continue
            sig = voice_signature(ctrl)
            if sig not in played_signatures and not any(q[0] == sig for q in queue):
                dur = parse_duration(ctrl.get("description", "") + " " + ctrl.get("title", ""))
                queue.append((sig, ctrl_path, dur))
                print(f"\n[Incoming voice note detected] Duration: ~{dur}s | Playing...")

        while queue and (stop is None or not stop.is_set()):
            sig, button_path, dur = queue.pop(0)
            try:
                press(button_path, expected_label=cfg.voice_play_marker)
            except Exception as exc:
                fail_counts[sig] = fail_counts.get(sig, 0) + 1
                print(f"Playback trigger failed for {button_path} (attempt {fail_counts[sig]}/3): {exc}")
                if fail_counts[sig] >= 3:
                    # Give up loudly; never silently drop a note.
                    played_signatures.add(sig)
                    print(f"Skipping voice note after 3 failed play attempts: {sig[:80]}")
                continue
            # Only mark as played after the press actually landed.
            played_signatures.add(sig)
            fail_counts.pop(sig, None)
            _wait_for_completion(cfg, button_path, dur, stop, get_snapshot)
            print("[Voice note playback finished]")

