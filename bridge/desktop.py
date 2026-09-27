import subprocess
import threading
import time
from .diagnostics import event
from pathlib import Path
from .ax import (snapshot, verify_header, focus_composer, ensure_whatsapp_ready,
                 click_element_by_description, click_preview_send, hide_whatsapp, activate_whatsapp)

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"


def _composer_text(rows):
    """Text currently sitting in the message composer (not an attachment preview)."""
    comps = [r for r in rows if r.get("role") == "AXTextArea" and "compose message" in (r.get("description") or "").lower()]
    if not comps:
        comps = [r for r in rows if r.get("role") == "AXTextArea" and "caption" not in (r.get("description") or "").lower()]
    return " ".join(((r.get("value") or "") + " " + (r.get("title") or "")) for r in comps).strip()


def _classify_paste_state(rows, filename):
    """Classify WhatsApp's state after a paste attempt.

    A real attachment preview shows a caption field or Cancel button and names
    the file. A paste that WhatsApp could not turn into an attachment either
    vanishes (empty) or lands in the composer as plain text (polluted), and the
    two cases must be told apart before any fallback may touch the chat.
    """
    caption = any(r.get("role") == "AXTextArea" and "caption" in (r.get("description") or "").lower()
                  for r in rows)
    cancel = any(r.get("role") == "AXButton" and "cancel" in
                 ((r.get("description") or "") + " " + (r.get("title") or "")).lower()
                 for r in rows)
    filename_seen = any(filename in " ".join(str(r.get(k) or "") for k in ("title", "value", "description"))
                        for r in rows)
    composer = _composer_text(rows)
    return {
        "preview": bool((caption or cancel) and filename_seen),
        "caption": caption,
        "cancel": cancel,
        "filename_seen": bool(filename_seen),
        "composer_polluted": bool(filename) and filename in composer,
        "composer_chars": len(composer),
    }


def _picker_menu_items(rows, attach_label, before):
    """Find menu choices in the open attach popover, excluding unrelated menus."""
    old = {(r.get("path"), r.get("role"), r.get("title"), r.get("description")) for r in before}
    items = []
    for row in rows:
        role = row.get("role")
        if role not in ("AXMenuItem", "AXButton"):
            continue
        label = (row.get("description") or row.get("title") or "").strip("\u200e ")
        if not label or label.casefold() == attach_label.casefold():
            continue
        path = row.get("path", "")
        if (path, role, row.get("title"), row.get("description")) not in old:
            items.append({"path": path, "role": role, "label": label})
    return items


def _press_picker_item(item):
    """Press exact snapshotted menu control only if its role and label still match."""
    from ApplicationServices import (AXUIElementCreateApplication, AXUIElementCopyAttributeValue,
                                     AXUIElementPerformAction)
    from .ax import get_whatsapp_pid
    pid = get_whatsapp_pid()
    if not pid:
        return False
    el = AXUIElementCreateApplication(pid)
    for part in item["path"].split("/")[1:]:
        if not part.isdigit() or int(part) >= 300:
            return False
        err, children = AXUIElementCopyAttributeValue(el, "AXChildren", None)
        if err or not children or int(part) >= len(children):
            return False
        el = children[int(part)]
    def attr(name):
        err, value = AXUIElementCopyAttributeValue(el, "AX" + name, None)
        return str(value or "") if err == 0 else ""
    if attr("Role") != item["role"]:
        return False
    if item["label"].casefold() not in [v.strip("\u200e ").casefold() for v in (attr("Description"), attr("Title"))]:
        return False
    return AXUIElementPerformAction(el, "AXPress") == 0


class Desktop:
    def __init__(self, cfg):
        self.cfg = cfg
        self._lock = threading.Lock()
        self._clipboard_unsupported = False

    def assert_locked(self):
        ensure_whatsapp_ready(self.cfg.number)
        try:
            return verify_header(snapshot(safe_mode=self.cfg.safe_mode), self.cfg.number, self.cfg.header_path, safe_mode=self.cfg.safe_mode)
        except Exception as exc:
            if self.cfg.safe_mode:
                raise
            print(f"Warning (unlocked mode): Chat verification check: {exc}")
            return False

    def send(self, text):
        if not text.strip() or len(text) > 1000 or "\n" in text:
            raise ValueError("Message must be nonempty, under 1000 chars, single line")
        with self._lock:
            ensure_whatsapp_ready(self.cfg.number)
            self.assert_locked()
            focus_composer()
            subprocess.run(["osascript", str(SCRIPTS / "send.scpt"), self.cfg.number, text], check=True)
            self.assert_locked()
            subprocess.run(["osascript", str(SCRIPTS / "commit.scpt")], check=True)
            time.sleep(0.3)
            hide_whatsapp()

    def send_tool_response(self, text: str):
        """Send a multiline tool execution response back to Jarvis on WhatsApp."""
        if not text or not text.strip():
            raise ValueError("Tool response text must be nonempty")
        if len(text) > 4000:
            text = text[:3900] + "\n... [Truncated for WhatsApp]"
        with self._lock:
            ensure_whatsapp_ready(self.cfg.number)
            self.assert_locked()
            focus_composer()
            subprocess.run(["osascript", str(SCRIPTS / "send.scpt"), self.cfg.number, text], check=True)
            self.assert_locked()
            subprocess.run(["osascript", str(SCRIPTS / "commit.scpt")], check=True)
            time.sleep(0.3)
            hide_whatsapp()

    def _send_audio_picker(self, path):
        """Attach > Document picker route."""
        if not all((self.cfg.attach_label, self.cfg.document_label, self.cfg.attachment_send_label)):
            if self.cfg.safe_mode:
                raise RuntimeError("Attachment UI labels not calibrated; no send")
            attach = self.cfg.attach_label or "Share media"
            doc = self.cfg.document_label or "File"
            send_btn = self.cfg.attachment_send_label or "Send"
        else:
            attach = self.cfg.attach_label
            doc = self.cfg.document_label
            send_btn = self.cfg.attachment_send_label
        self.assert_locked()
        before_menu = snapshot(safe_mode=self.cfg.safe_mode)
        if not click_element_by_description(attach):
            event("picker_step", level="warning", step="attach", ok=False, label=attach)
            raise RuntimeError(f"Attach control '{attach}' not found; no send")
        event("picker_step", step="attach", ok=True, label=attach)
        # File/document preserves M4A as an audio attachment. Do not choose
        # Photos & videos: it might reject or transform the recording.
        preferred = list(dict.fromkeys(x.casefold() for x in
                       (doc, "Document", "Documents", "File", "Files") if x))
        t0 = time.monotonic()
        items = []
        while time.monotonic() - t0 < 3.0:
            items = _picker_menu_items(snapshot(safe_mode=self.cfg.safe_mode), attach, before_menu)
            if items:
                break
            time.sleep(0.1)
        event("picker_menu_items", items=[{"label": i["label"], "role": i["role"]} for i in items])
        selected = None
        for name in preferred:
            matches = [i for i in items if i["label"].casefold() == name]
            if len(matches) == 1:
                selected = matches[0]
                break
        labels = ", ".join(f"{i['label']} ({i['role']})" for i in items) or "none visible"
        if selected is None:
            event("picker_step", level="warning", step="document", ok=False, label=doc, available=labels)
            raise RuntimeError(f"Document/file attach item not found; menu items: {labels}; no send")
        if not _press_picker_item(selected):
            event("picker_step", level="warning", step="document", ok=False, label=selected["label"], available=labels)
            raise RuntimeError(f"Attach item '{selected['label']}' could not be pressed; menu items: {labels}; no send")
        event("picker_step", step="document", ok=True, label=selected["label"])
        time.sleep(0.35)
        subprocess.run(["osascript", str(SCRIPTS / "attach.scpt"), str(path)], check=True, timeout=25)
        event("picker_step", step="chooser", ok=True)
        if not click_preview_send(timeout=5.0):
            event("picker_step", level="warning", step="preview_send", ok=False, note="commit-audio fallback")
            subprocess.run(["osascript", str(SCRIPTS / "commit-audio.scpt"), send_btn], check=True, timeout=15)
        event("picker_step", step="dispatch", ok=True)

    def _stage_clipboard(self, path):
        """Put the file on the clipboard as both a file URL and the legacy filenames flavor."""
        try:
            from AppKit import NSPasteboard
            from Foundation import NSURL
            board = NSPasteboard.generalPasteboard()
            board.clearContents()
            ok = bool(board.writeObjects_([NSURL.fileURLWithPath_(str(path))]))
            try:
                # Some WhatsApp builds only honor the legacy filenames flavor on paste.
                board.setPropertyList_forType_([str(path)], "NSFilenamesPboardType")
            except Exception:
                pass
            event("clipboard_stage", ok=ok)
            return ok
        except (ImportError, OSError) as exc:
            print(f"Clipboard file staging unavailable: {exc}; using file picker")
            event("clipboard_stage", level="warning", ok=False, error=str(exc)[:120])
            return False

    def _keystroke_paste(self):
        subprocess.run(["osascript", "-e", 'tell application "System Events" to tell process "WhatsApp" to keystroke "v" using command down'],
                       check=True, timeout=8)

    def _menu_paste(self):
        try:
            res = subprocess.run(["osascript", "-e",
                                  'tell application "System Events" to tell process "WhatsApp" to click menu item "Paste" of menu 1 of menu bar item "Edit" of menu bar 1'],
                                 check=False, capture_output=True, timeout=8)
            return res.returncode == 0
        except Exception:
            return False

    def _clear_composer(self, path):
        """Remove pasted-as-text draft content from the composer; verify it is gone."""
        if not focus_composer():
            return False
        subprocess.run(["osascript", "-e", 'tell application "System Events" to tell process "WhatsApp" to keystroke "a" using command down'],
                       check=False, timeout=8)
        time.sleep(0.1)
        subprocess.run(["osascript", "-e", 'tell application "System Events" to tell process "WhatsApp" to key code 51'],
                       check=False, timeout=8)
        time.sleep(0.3)
        rows = snapshot(safe_mode=self.cfg.safe_mode)
        composer = _composer_text(rows)
        return path.name not in composer and str(path) not in composer

    def _await_preview(self, path, attempt, timeout=8.0):
        """Poll after a paste. Returns (outcome, state): preview | polluted | ambiguous | empty."""
        deadline = time.monotonic() + timeout
        last_log = 0.0
        state = None
        while True:
            rows = snapshot(safe_mode=self.cfg.safe_mode)
            state = _classify_paste_state(rows, path.name)
            now = time.monotonic()
            if now - last_log >= 2.0:
                last_log = now
                event("paste_poll", level="debug", attempt=attempt, elapsed_s=round(timeout - (deadline - now), 1), **state)
            if state["preview"]:
                return "preview", state
            if state["composer_polluted"]:
                return "polluted", state
            if now >= deadline:
                break
            time.sleep(0.25)
        if state["caption"] or state["cancel"] or state["filename_seen"]:
            return "ambiguous", state
        return "empty", state

    def _paste_audio(self, path):
        """Try the clipboard route.

        Returns True on a confirmed preview send; "picker" when the paste was
        provably ignored or landed as plain text (draft cleaned), so the picker
        route is safe; raises when the outcome cannot be determined, so no
        duplicate can ever be sent blindly.
        """
        if not self._stage_clipboard(path):
            return "picker"
        if not focus_composer():
            event("paste_outcome", level="warning", outcome="focus_failed")
            return "picker"
        self.assert_locked()
        # A verified empty paste should not trigger a second AppleScript paste.
        # On some Desktop builds the Edit menu command blocks; use the picker.
        event("paste_attempt", attempt=1, method="keystroke")
        self._keystroke_paste()
        outcome, state = self._await_preview(path, 1)
        event("paste_outcome", outcome=outcome, attempt=1,
              preview_markers=bool(state["caption"] or state["cancel"]),
              filename_seen=state["filename_seen"],
              composer_polluted=state["composer_polluted"],
              composer_chars=state["composer_chars"])
        if outcome == "preview":
            if click_preview_send(timeout=6.0):
                event("preview_send", ok=True)
                return True
            event("preview_send", level="warning", ok=False)
            raise RuntimeError("Pasted audio preview not confirmed sent; inspect WhatsApp before retrying")
        if outcome == "ambiguous":
            raise RuntimeError("Paste outcome unknown; inspect WhatsApp draft before retrying")
        if outcome == "polluted":
            cleared = self._clear_composer(path)
            event("composer_cleared", ok=cleared)
            if not cleared:
                raise RuntimeError("Paste inserted only text and the draft could not be cleared; clear the WhatsApp composer before retrying")
        event("paste_fallback", reason=outcome, route="picker")
        return "picker"

    def send_audio(self, path):
        """Send recorded M4A: clipboard paste first, picker fallback only when provably safe."""
        path = Path(path).resolve()
        if not path.is_file() or path.suffix.lower() != ".m4a" or path.stat().st_size < 1000:
            raise ValueError("Audio must be an M4A file of at least 1 KB")
        route_pref = (getattr(self.cfg, "send_route", "") or "auto").strip().lower()
        with self._lock:
            ensure_whatsapp_ready(self.cfg.number)
            self.assert_locked()
            activate_whatsapp()
            time.sleep(0.15)
            use_clipboard = route_pref not in ("picker",) and not self._clipboard_unsupported
            if use_clipboard:
                event("audio_send_route", route="clipboard", bytes=path.stat().st_size)
                result = self._paste_audio(path)
                if result == "picker":
                    if route_pref == "clipboard":
                        raise RuntimeError("Clipboard paste could not deliver the file and BRIDGE_SEND_ROUTE=clipboard forbids the picker fallback")
                    self._clipboard_unsupported = True
                    event("audio_send_route", route="picker_fallback", reason="clipboard_unsupported")
                    try:
                        self._send_audio_picker(path)
                    except Exception as exc:
                        event("picker_failed", level="error", error=type(exc).__name__, detail=str(exc)[:180])
                        raise
                    event("picker_done", route="picker_fallback")
            else:
                event("audio_send_route", route="picker",
                      reason="configured" if route_pref == "picker" else "clipboard_unsupported_this_session",
                      bytes=path.stat().st_size)
                try:
                    self._send_audio_picker(path)
                except Exception as exc:
                    event("picker_failed", level="error", error=type(exc).__name__, detail=str(exc)[:180])
                    raise
                event("picker_done", route="picker")
            time.sleep(0.4)
            hide_whatsapp()


def _audio_preview_visible(rows, filename):
    """Require a preview control and exact filename, not a message-list mention."""
    return _classify_paste_state(rows, filename)["preview"]

