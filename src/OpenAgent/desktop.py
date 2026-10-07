import subprocess
import threading
import time
from .diagnostics import event
from pathlib import Path
from .ax import (snapshot, verify_header, focus_composer, ensure_whatsapp_ready,
                 click_element_by_description, click_preview_send, hide_whatsapp, activate_whatsapp)

_here = Path(__file__).resolve()
_repo = _here.parents[2] if len(_here.parents) > 2 and _here.parents[1].name == "src" else _here.parents[1]
SCRIPTS = _repo / "scripts"


class Desktop:
    def __init__(self, cfg):
        self.cfg = cfg
        self._lock = threading.Lock()

    def is_locked(self) -> bool:
        """Check whether the active WhatsApp chat matches the verified Instinct bridge chat."""
        try:
            return bool(self.assert_locked(quick=True))
        except Exception:
            return False

    def assert_locked(self, quick=False, hide_after=True):
        """Assert that WhatsApp is on the verified bridge chat. Raises RuntimeError if not."""
        if not quick:
            ensure_whatsapp_ready(self.cfg.number, hide_after=hide_after)
        rows = snapshot(safe_mode=self.cfg.safe_mode)
        try:
            ok = verify_header(rows, self.cfg.number, self.cfg.header_path, safe_mode=self.cfg.safe_mode)
        except Exception as exc:
            raise RuntimeError(f"Chat verification check failed: {exc}") from exc
        if not ok:
            raise RuntimeError(
                f"Selected chat number/path mismatch. Destination '{self.cfg.number}' "
                f"is not the active chat in WhatsApp Desktop. Refusing to send message."
            )
        return True

    def send(self, text):
        if not text.strip() or len(text) > 1000 or "\n" in text:
            raise ValueError("Message must be nonempty, under 1000 chars, single line")
        with self._lock:
            activate_whatsapp()
            if not self.is_locked():
                ensure_whatsapp_ready(self.cfg.number, hide_after=False)
            self.assert_locked()
            focus_composer()
            self.assert_locked(quick=True)
            subprocess.run(["osascript", str(SCRIPTS / "send.scpt"), self.cfg.number, text], check=True)
            self.assert_locked(quick=True)
            subprocess.run(["osascript", str(SCRIPTS / "commit.scpt")], check=True)
            time.sleep(0.3)
            hide_whatsapp()

    def send_tool_response(self, text: str):
        """Send a multiline tool execution response back to Jarvis on WhatsApp with minimal latency.
        
        Guarantees that responses are delivered ONLY to the verified Instinct bridge chat,
        regardless of which chat was opened by tools or user actions.
        """
        if not text or not text.strip():
            raise ValueError("Tool response text must be nonempty")
        if len(text) > 4000:
            text = text[:3900] + "\n... [Truncated for WhatsApp]"
        with self._lock:
            activate_whatsapp()
            # If WhatsApp is on a different chat (e.g. opened by mac_* tool), switch back now
            if not self.is_locked():
                ensure_whatsapp_ready(self.cfg.number, hide_after=False)
            self.assert_locked()

            focus_composer()

            max_attempts = 2
            for attempt in range(max_attempts):
                try:
                    self.assert_locked(quick=True)
                    subprocess.run(["osascript", str(SCRIPTS / "send.scpt"), self.cfg.number, text], check=True)
                    self.assert_locked(quick=True)
                    subprocess.run(["osascript", str(SCRIPTS / "commit.scpt")], check=True)
                    break
                except (subprocess.CalledProcessError, RuntimeError):
                    if attempt < max_attempts - 1:
                        activate_whatsapp()
                        ensure_whatsapp_ready(self.cfg.number, hide_after=False)
                        self.assert_locked()
                        focus_composer()
                        time.sleep(0.2)
                    else:
                        raise
            time.sleep(0.05)
            hide_whatsapp()

    def _stage_clipboard(self, path):
        """Put the file on macOS clipboard as both file URL and legacy filenames flavor."""
        try:
            from AppKit import NSPasteboard
            from Foundation import NSURL
            board = NSPasteboard.generalPasteboard()
            board.clearContents()
            ok = bool(board.writeObjects_([NSURL.fileURLWithPath_(str(path))]))
            try:
                board.setPropertyList_forType_([str(path)], "NSFilenamesPboardType")
            except Exception:
                pass
            return ok
        except Exception:
            return False

    def _send_file_clipboard(self, path):
        """Send file directly via clipboard paste (Cmd+V), bypassing the entire filepicker UI."""
        if not self._stage_clipboard(path):
            return False
        focus_composer()
        time.sleep(0.04)
        subprocess.run(
            ["osascript", str(SCRIPTS / "paste-file.scpt")],
            check=False, timeout=4.0
        )
        if click_preview_send(timeout=4.0):
            event("picker_step", step="dispatch", ok=True, method="clipboard")
            return True
        return False

    def send_file(self, path):
        """Send any file (audio M4A, image PNG, doc) directly via clipboard paste without opening filepicker, with fallback to picker."""
        path = Path(path).resolve()
        if not path.is_file() or path.stat().st_size == 0:
            raise ValueError(f"File must be an existing, non-empty file: {path}")
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

        with self._lock:
            # Dismiss any stale modal/preview from an earlier attempt
            if click_element_by_description("Cancel"):
                time.sleep(0.05)
            activate_whatsapp()
            if not self.is_locked():
                ensure_whatsapp_ready(self.cfg.number, hide_after=False)
            self.assert_locked()

            try:
                # 1. DIRECT CLIPBOARD ATTACHMENT (Instant, zero filepicker UI, no dialog hanging)
                if self._send_file_clipboard(path):
                    time.sleep(0.05)
                    return True

                # 2. FALLBACK PICKER ROUTE (Used only if clipboard paste did not open preview)
                event("picker_step", step="fallback_to_picker", reason="clipboard_unhandled")
                t0 = time.monotonic()
                clicked_attach = False
                while time.monotonic() - t0 < 3.0:
                    if click_element_by_description(attach):
                        clicked_attach = True
                        break
                    time.sleep(0.02)
                if not clicked_attach:
                    if click_element_by_description("Cancel"):
                        time.sleep(0.05)
                        if click_element_by_description(attach):
                            clicked_attach = True
                    if not clicked_attach:
                        raise RuntimeError(f"Attach control '{attach}' not found; no send")
                event("picker_step", step="attach", ok=True, label=attach)

                t0 = time.monotonic()
                clicked_doc = False
                while time.monotonic() - t0 < 3.0:
                    if click_element_by_description(doc):
                        clicked_doc = True
                        break
                    time.sleep(0.02)
                if not clicked_doc:
                    event("picker_step", level="warning", step="document", ok=False, label=doc)
                    raise RuntimeError(f"Document menu item '{doc}' not found; no send")
                event("picker_step", step="document", ok=True, label=doc)

                time.sleep(0.1)
                subprocess.run(["osascript", str(SCRIPTS / "attach.scpt"), str(path)], check=True, timeout=25)
                event("picker_step", step="chooser", ok=True)

                if not click_preview_send(timeout=5.0):
                    subprocess.run(["osascript", str(SCRIPTS / "commit-audio.scpt"),
                                    send_btn], check=True, timeout=15)
                event("picker_step", step="dispatch", ok=True, method="picker")
                time.sleep(0.05)
                return True
            except Exception:
                try:
                    click_element_by_description("Cancel")
                except Exception:
                    pass
                hide_whatsapp()
                raise
            finally:
                hide_whatsapp()

    def send_audio(self, path):
        """Prepare an M4A as a document attachment, dispatch it, then immediately hide WhatsApp."""
        path = Path(path).resolve()
        if not path.is_file() or path.suffix.lower() != ".m4a" or path.stat().st_size < 1000:
            raise ValueError("Audio must be an M4A file of at least 1 KB")
        return self.send_file(path)

