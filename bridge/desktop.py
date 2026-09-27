import subprocess
import threading
import time
from .diagnostics import event
from pathlib import Path
from .ax import (snapshot, verify_header, focus_composer, ensure_whatsapp_ready,
                 click_element_by_description, click_preview_send, hide_whatsapp, activate_whatsapp)

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"


class Desktop:
    def __init__(self, cfg):
        self.cfg = cfg
        self._lock = threading.Lock()

    def assert_locked(self, quick=False):
        if not quick:
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
        """Send a multiline tool execution response back to Jarvis on WhatsApp with minimal latency."""
        if not text or not text.strip():
            raise ValueError("Tool response text must be nonempty")
        if len(text) > 4000:
            text = text[:3900] + "\n... [Truncated for WhatsApp]"
        with self._lock:
            # Single quick verification of chat target before paste (skips redundant menu walking)
            self.assert_locked(quick=True)
            subprocess.run(["osascript", str(SCRIPTS / "send.scpt"), self.cfg.number, text], check=True)
            subprocess.run(["osascript", str(SCRIPTS / "commit.scpt")], check=True)
            time.sleep(0.05)
            hide_whatsapp()

    def send_audio(self, path):
        """Prepare an M4A as a document attachment, dispatch it, then immediately hide WhatsApp.

        File-picker input system restored verbatim from commit c8d938d8 (the
        last state where it worked on Hamdan's build), plus the shared send
        lock and picker_step log breadcrumbs.
        """
        path = Path(path).resolve()
        if not path.is_file() or path.suffix.lower() != ".m4a" or path.stat().st_size < 1000:
            raise ValueError("Audio must be an M4A file of at least 1 KB")
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
            ensure_whatsapp_ready(self.cfg.number)
            self.assert_locked()
            activate_whatsapp()
            time.sleep(0.15)
            # Open file picker using direct AX clicks; fail closed if they miss.
            if not click_element_by_description(attach):
                raise RuntimeError(f"Attach control '{attach}' not found; no send")
            event("picker_step", step="attach", ok=True, label=attach)

            # Poll briefly for the document menu item to appear in the popover
            t0 = time.monotonic()
            clicked_doc = False
            while time.monotonic() - t0 < 3.0:
                if click_element_by_description(doc):
                    clicked_doc = True
                    break
                time.sleep(0.1)
            if not clicked_doc:
                event("picker_step", level="warning", step="document", ok=False, label=doc)
                raise RuntimeError(f"Document menu item '{doc}' not found; no send")
            event("picker_step", step="document", ok=True, label=doc)
            time.sleep(0.35)
            subprocess.run(["osascript", str(SCRIPTS / "attach.scpt"), str(path)], check=True, timeout=25)
            event("picker_step", step="chooser", ok=True)

            # In preview, the chat header is replaced by the attachment preview window.
            # Click the preview Send button or press Enter, then immediately hide WhatsApp.
            if not click_preview_send(timeout=5.0):
                subprocess.run(["osascript", str(SCRIPTS / "commit-audio.scpt"),
                                send_btn], check=True, timeout=15)
            event("picker_step", step="dispatch", ok=True)
            time.sleep(0.4)
            hide_whatsapp()
