import subprocess
import threading
import time
from pathlib import Path
from .ax import (snapshot, verify_header, focus_composer, ensure_whatsapp_ready,
                 click_element_by_description, click_preview_send, hide_whatsapp, activate_whatsapp)

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"

class Desktop:
    def __init__(self, cfg):
        self.cfg = cfg
        self._lock = threading.Lock()

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
        """Legacy picker route; call only before any paste was attempted."""
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
        if not click_element_by_description(attach):
            raise RuntimeError(f"Attach control '{attach}' not found; no send")
        t0 = time.monotonic()
        while time.monotonic() - t0 < 3.0:
            if click_element_by_description(doc):
                break
            time.sleep(0.1)
        else:
            raise RuntimeError(f"Document menu item '{doc}' not found; no send")
        time.sleep(0.35)
        subprocess.run(["osascript", str(SCRIPTS / "attach.scpt"), str(path)], check=True, timeout=25)
        if not click_preview_send(timeout=5.0):
            subprocess.run(["osascript", str(SCRIPTS / "commit-audio.scpt"), send_btn], check=True, timeout=15)

    def _paste_audio(self, path):
        """Paste a file URL into the verified chat. Unknown outcome never falls back."""
        try:
            from AppKit import NSPasteboard
            from Foundation import NSURL
            board = NSPasteboard.generalPasteboard()
            board.clearContents()
            if not board.writeObjects_([NSURL.fileURLWithPath_(str(path))]):
                return False
        except (ImportError, OSError) as exc:
            print(f"Clipboard file staging unavailable: {exc}; using file picker")
            return False
        if not focus_composer():
            return False
        self.assert_locked()
        subprocess.run(["osascript", "-e", 'tell application "System Events" to tell process "WhatsApp" to keystroke "v" using command down'],
                       check=True, timeout=8)
        # Never use the picker after a paste attempt: an unseen draft may exist.
        deadline = time.monotonic() + 4.0
        while time.monotonic() < deadline:
            rows = snapshot(safe_mode=self.cfg.safe_mode)
            if _audio_preview_visible(rows, path.name):
                break
            time.sleep(0.2)
        else:
            raise RuntimeError("Paste outcome unknown; inspect WhatsApp draft before retrying")
        if not click_preview_send(timeout=5.0):
            raise RuntimeError("Pasted audio preview not confirmed sent; inspect WhatsApp before retrying")
        return True

    def send_audio(self, path):
        """Send recorded M4A by clipboard paste, with pre-paste picker fallback."""
        path = Path(path).resolve()
        if not path.is_file() or path.suffix.lower() != ".m4a" or path.stat().st_size < 1000:
            raise ValueError("Audio must be an M4A file of at least 1 KB")
        with self._lock:
            ensure_whatsapp_ready(self.cfg.number)
            self.assert_locked()
            activate_whatsapp()
            time.sleep(0.15)
            if not self._paste_audio(path):
                self._send_audio_picker(path)
            time.sleep(0.4)
            hide_whatsapp()


def _audio_preview_visible(rows, filename):
    """Require a preview control and exact filename, not a message-list mention."""
    preview = any(r.get("role") == "AXTextArea" and "caption" in (r.get("description") or "").lower()
                  for r in rows)
    preview |= any(r.get("role") == "AXButton" and "cancel" in
                   ((r.get("description") or "") + " " + (r.get("title") or "")).lower()
                   for r in rows)
    return bool(preview and any(filename in " ".join(str(r.get(k) or "") for k in ("title", "value", "description"))
                                for r in rows))
