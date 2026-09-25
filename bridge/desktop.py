import subprocess
from pathlib import Path
from .ax import snapshot, verify_header

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"

class Desktop:
    def __init__(self, cfg): self.cfg = cfg
    def assert_locked(self): verify_header(snapshot(), self.cfg.number, self.cfg.header_path)
    def send(self, text):
        if not text.strip() or len(text) > 1000 or "\n" in text:
            raise ValueError("Message must be nonempty, under 1000 chars, single line")
        self.assert_locked()
        subprocess.run(["osascript", str(SCRIPTS / "send.scpt"), self.cfg.number, text], check=True)
        self.assert_locked()
        subprocess.run(["osascript", str(SCRIPTS / "commit.scpt")], check=True)
