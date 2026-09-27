"""Opt-in, fail-closed WhatsApp Desktop AX voice-note playback.

Requires local calibration of the selected chat, incoming direction, and the
voice-note play/pause control. Never speaks text or reads notifications.
"""
import hashlib
import re
import time
import logging
from .diagnostics import event
from .ax import snapshot, verify_header, press_button
from .dispatcher import parse_tool_calls, execute_tool_call, format_tool_responses


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
    target_num = "".join(c for c in (cfg.number or "") if c.isdigit())
    marker = (cfg.incoming_marker or "").strip().lower()

    for group in groups:
        grp_path = group.get("path", "")
        descendants = [r for r in children if under(r.get("path", ""), grp_path) or r.get("path") == grp_path]
        metadata = [r for r in descendants if r.get("role") != "AXStaticText"]
        if not metadata:
            metadata = descendants
        meta_label = " ".join((r.get("title", "") + " " + r.get("description", "")).lower() for r in metadata)

        # Skip outgoing messages
        if any(out in meta_label for out in ("your message", "outgoing", "you:")):
            continue

        # Check for incoming direction
        is_incoming = False
        if marker and marker in meta_label:
            is_incoming = True
        elif "incoming" in meta_label:
            is_incoming = True
        elif target_num and target_num in "".join(c for c in meta_label if c.isdigit()):
            is_incoming = True
        elif not cfg.safe_mode:
            is_incoming = True

        if not is_incoming:
            continue

        text_nodes = [r for r in descendants if r.get("role") in ("AXStaticText", "AXTextArea")]
        body_parts = []
        for r in text_nodes:
            val = (r.get("value") or "").strip()
            title = (r.get("title") or "").strip()
            chunk = val or title
            if chunk:
                body_parts.append(chunk)

        if not body_parts:
            # Some WhatsApp builds put the body on the bubble group's AXValue.
            # Never take description/title, which often contain sender metadata.
            val = (group.get("value") or "").strip()
            if val.startswith("JARVIS_CALL:"):
                body_parts.append(val)
        if not body_parts:
            continue

        full_text = "\n".join(body_parts).strip()
        if not full_text:
            continue

        # Prevent loop: never process our own tool response
        if full_text.startswith("[Jarvis Tool Response:"):
            continue

        group_meta = " ".join(group.get(k, "") for k in ("title", "description")).strip()
        text_hash = hashlib.sha256(full_text.encode("utf-8")).hexdigest()[:16]
        sig = f"{grp_path}:{group_meta}:{text_hash}"
        result.append((grp_path, full_text, sig))

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


def _wait_for_completion(cfg, button_path, dur, stop, get_snapshot):
    """Hold the mic guard until playback ends, never on a stale Play label.

    AX may lag and show Play while the note is audible. If duration is known,
    preserve the guard for at least that long; if the path disappears, wait
    out the duration. An unknown duration without a pause transition holds
    to the configured cap instead of releasing after three seconds.
    """
    play = cfg.voice_play_marker.casefold()
    pause = cfg.voice_pause_marker.casefold()
    started = time.monotonic()
    cap = max(10.0, float(cfg.max_voice_seconds or 300))
    minimum = float(dur) + 1.0 if dur else 0.0
    wait_end = started + min(cap, max(minimum + 5.0, 10.0) if dur else cap)
    saw_pause = False
    while time.monotonic() < wait_end:
        if stop is not None and stop.is_set():
            return
        ctrl = None
        try:
            try:
                rows = get_snapshot(safe_mode=cfg.safe_mode)
            except TypeError:
                rows = get_snapshot()
            ctrl = next((r for r in rows if r["path"] == button_path), None)
        except Exception:
            pass
        if ctrl is not None:
            lab = _label(ctrl)
            if pause in lab:
                saw_pause = True
            elif play in lab and saw_pause and time.monotonic() - started >= minimum:
                event("echo_guard", state="playback_completed", elapsed_s=round(time.monotonic() - started, 2), duration_s=dur)
                return
        if stop is not None:
            stop.wait(0.5)
        else:
            time.sleep(0.5)
    event("echo_guard", state="playback_wait_expired", level="warning", elapsed_s=round(time.monotonic() - started, 2), duration_s=dur, saw_pause=saw_pause)


def watch(cfg, timeout=None, stop=None, get_snapshot=snapshot, press=press_button, state=None, pause=None, desk=None, harness=None, playing=None):
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

    processed_texts = state.get("processed_texts")
    if processed_texts is None:
        # First window only: baseline existing incoming text messages so chat history is not re-executed
        processed_texts = set()
        try:
            initial_rows = checked()
            for grp_path, text, sig in incoming_texts(initial_rows, cfg):
                processed_texts.add(sig)
            event("text_baseline", count=len(processed_texts))
        except Exception:
            logging.getLogger("jarvis.watcher").exception("Text baseline failed; watcher must not replay history")
            raise
        state["processed_texts"] = processed_texts

    queue = state.setdefault("queue", [])
    fail_counts = state.setdefault("fails", {})

    warned_missing = state.get("warned_missing", False)
    while (time.monotonic() < deadline or queue) and (stop is None or not stop.is_set()):
        if pause is not None and pause.is_set():
            if stop is not None: stop.wait(0.5)
            else: time.sleep(0.5)
            continue
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

        if pause is not None and pause.is_set():
            continue
        row_map = {r["path"]: r for r in rows}

        # 1. Voice reply check (if voice markers calibrated)
        if cfg.voice_play_marker and cfg.voice_pause_marker:
            try:
                current_groups = voice_groups(rows, cfg)
                warned_missing = False
                state["warned_missing"] = False
                for grp_path, ctrl_path in current_groups:
                    ctrl = row_map.get(ctrl_path)
                    if not ctrl: continue
                    sig = voice_signature(ctrl)
                    if sig not in played_signatures and not any(q[0] == sig for q in queue):
                        dur = parse_duration(ctrl.get("description", "") + " " + ctrl.get("title", ""))
                        queue.append((sig, ctrl_path, dur))
                        if playing is not None:
                            playing.set()  # Block capture as soon as reply is queued.
                        event("voice_note_queued", duration_s=dur)
                        print(f"\n[Incoming voice note detected] Duration: ~{dur}s | Playing...")
            except Exception as exc:
                if cfg.safe_mode:
                    raise
                if "Message list path missing or ambiguous" in str(exc):
                    if not warned_missing:
                        print("Voice scan unavailable: calibrated BRIDGE_MESSAGE_LIST_PATH is not visible.")
                        warned_missing = True
                        state["warned_missing"] = True
                else:
                    print(f"Voice scan paused (unlocked mode): {exc}")

        # 2. Text tool call check (if desk and harness connected)
        if desk is not None and harness is not None:
            try:
                current_texts = incoming_texts(rows, cfg)
                event("text_scan_result", level="debug", count=len(current_texts))
                for grp_path, msg_text, sig in current_texts:
                    if sig in processed_texts:
                        continue
                    # Mark only after a response has been sent; failed sends are retryable.
                    tool_calls = parse_tool_calls(msg_text)
                    if not tool_calls:
                        processed_texts.add(sig)
                        event("text_ignored", level="debug", reason="no_call")
                        continue
                    event("tool_dispatch", calls=len(tool_calls), tools=[c.get("tool") for c in tool_calls])

                    print(f"\n[Incoming tool call detected from Jarvis ({len(tool_calls)} call{'s' if len(tool_calls) > 1 else ''})]")
                    responses = []
                    for call in tool_calls:
                        t_name = call.get("tool", "unknown")
                        print(f"Executing tool '{t_name}' via harness...")
                        res = execute_tool_call(harness, call)
                        responses.append(res)

                    processed_texts.add(sig)  # Execution may have side effects; never replay on send failure.
                    reply_text = format_tool_responses(responses)
                    print(f"Sending tool response back to WhatsApp...")
                    desk.send_tool_response(reply_text)
                    event("tool_response_sent", calls=len(tool_calls))
                    print("[Tool response sent successfully]")
            except Exception as exc:
                print(f"[Tool dispatch error] {exc}")
                logging.getLogger("jarvis.watcher").exception("Tool dispatch failed")

        # 3. Process voice playback queue
        while queue and (stop is None or not stop.is_set()) and (pause is None or not pause.is_set()):
            sig, button_path, dur = queue.pop(0)
            if playing is not None:
                playing.set()
                event("echo_guard", state="playback_started", duration_s=dur)
            try:
                press(button_path, expected_label=cfg.voice_play_marker)
                played_signatures.add(sig)
                fail_counts.pop(sig, None)
                _wait_for_completion(cfg, button_path, dur, stop, get_snapshot)
                print("[Voice note playback finished]")
            except Exception as exc:
                fail_counts[sig] = fail_counts.get(sig, 0) + 1
                print(f"Playback trigger failed for {button_path} (attempt {fail_counts[sig]}/3): {exc}")
                if fail_counts[sig] >= 3:
                    played_signatures.add(sig)
                    print(f"Skipping voice note after 3 failed play attempts: {sig[:80]}")
                continue
            finally:
                if playing is not None:
                    # Echo-tail buffer: keep playing set briefly so acoustic room reverberation dissipates
                    if stop is not None:
                        stop.wait(2.0)
                    else:
                        time.sleep(2.0)
                    playing.clear()
                    event("echo_guard", state="cooldown_complete", seconds=2.0)

