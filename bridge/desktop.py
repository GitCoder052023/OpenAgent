import subprocess
from pathlib import Path
from .ax import snapshot, verify_header, focus_composer

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"

class Desktop:
    def __init__(self, cfg): self.cfg = cfg
    def assert_locked(self):
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
        self.assert_locked()
        focus_composer()
        subprocess.run(["osascript", str(SCRIPTS / "send.scpt"), self.cfg.number, text], check=True)
        self.assert_locked()
        subprocess.run(["osascript", str(SCRIPTS / "commit.scpt")], check=True)


    def send_audio(self, path):
        """Prepare an M4A as a document attachment, recheck chat, then send.

        This is NOT a native WhatsApp voice-note bubble. UI is locally calibrated.
        """
        path = Path(path).resolve()
        if not path.is_file() or path.suffix.lower() != ".m4a" or not 4000 <= path.stat().st_size <= 12_000_000:
            raise ValueError("Audio must be an M4A file between 4 KB and 12 MB")
        if not all((self.cfg.attach_label, self.cfg.document_label, self.cfg.attachment_send_label)):
            if self.cfg.safe_mode:
                raise RuntimeError("Attachment UI labels not calibrated; no send")
            attach = self.cfg.attach_label or "Attach"
            doc = self.cfg.document_label or "Document"
            send_btn = self.cfg.attachment_send_label or "Send"
        else:
            attach = self.cfg.attach_label
            doc = self.cfg.document_label
            send_btn = self.cfg.attachment_send_label

        self.assert_locked()
        subprocess.run(["osascript", str(SCRIPTS / "attach.scpt"), str(path),
                        attach, doc], check=True, timeout=25)
        # If this raises, a draft may be left in WhatsApp; operator clears it.
        self.assert_locked()
        subprocess.run(["osascript", str(SCRIPTS / "commit-audio.scpt"),
                        send_btn], check=True, timeout=15)
