"""Headless WhatsApp CLI (wacli) Adapter for OpenAgent.

Enables Commercial Instinct to interact with WhatsApp contacts, groups, and search
chat history directly from the terminal without requiring foreground GUI window manipulation.

Homepage: https://wacli.sh
"""

import json
import logging
import os
import shutil
import subprocess
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("openagent.wacli")


class WacliAdapter:
    """Dispatches calls to the headless WhatsApp CLI (wacli)."""

    def __init__(self, store_dir: Optional[str] = None):
        self.store_dir = store_dir or os.path.expanduser("~/.wacli")

    def _get_bin(self) -> Optional[str]:
        return shutil.which("wacli")

    def is_available(self) -> bool:
        return self._get_bin() is not None

    def _run(self, cmd_args: List[str], timeout: float = 30.0) -> Dict[str, Any]:
        bin_path = self._get_bin()
        if not bin_path:
            return {
                "status": "error",
                "error": "wacli is not installed. To install headless WhatsApp CLI, run: curl -fsSL https://wacli.sh/install | bash",
                "install_hint": "curl -fsSL https://wacli.sh/install | bash",
            }

        try:
            full_cmd = [bin_path] + cmd_args
            res = subprocess.run(
                full_cmd,
                capture_output=True,
                text=True,
                timeout=timeout,
            )
            output = res.stdout.strip()
            err = res.stderr.strip()
            return {
                "status": "ok" if res.returncode == 0 else "error",
                "exit_code": res.returncode,
                "stdout": output,
                "stderr": err,
                "output": output or err,
            }
        except subprocess.TimeoutExpired:
            return {"status": "error", "error": f"wacli command timed out after {timeout}s"}
        except Exception as exc:
            return {"status": "error", "error": f"Failed to execute wacli: {exc}"}

    def send(self, to: str, message: str, file_path: Optional[str] = None) -> Dict[str, Any]:
        """Send a WhatsApp message or file to a contact or group."""
        if not to:
            return {"status": "error", "error": "Missing 'to' recipient (phone number or JID)"}

        if file_path:
            f = Path(file_path).expanduser()
            if not f.exists():
                return {"status": "error", "error": f"File not found: {file_path}"}
            cmd = ["send", "file", "--to", str(to), "--file", str(f)]
            if message:
                cmd.extend(["--caption", str(message)])
            return self._run(cmd)
        else:
            if not message:
                return {"status": "error", "error": "Missing 'message' text"}
            return self._run(["send", "text", "--to", str(to), "--message", str(message)])

    def search(self, query: str, chat: Optional[str] = None, limit: int = 20) -> Dict[str, Any]:
        """Search WhatsApp message history."""
        if not query:
            return {"status": "error", "error": "Missing 'query' string for search"}
        cmd = ["messages", "search", str(query), "--limit", str(limit), "--json"]
        if chat:
            cmd.extend(["--chat", str(chat)])
        return self._run(cmd)

    def chats(self, query: Optional[str] = None, limit: int = 20) -> Dict[str, Any]:
        """List recent WhatsApp chats."""
        cmd = ["chats", "list", "--limit", str(limit), "--json"]
        if query:
            cmd.extend(["--query", str(query)])
        return self._run(cmd)

    def status(self) -> Dict[str, Any]:
        """Check wacli doctor and sync status."""
        return self._run(["doctor"])


_DEFAULT_WACLI_ADAPTER: Optional[WacliAdapter] = None


def get_default_wacli_adapter() -> WacliAdapter:
    global _DEFAULT_WACLI_ADAPTER
    if _DEFAULT_WACLI_ADAPTER is None:
        _DEFAULT_WACLI_ADAPTER = WacliAdapter()
    return _DEFAULT_WACLI_ADAPTER
