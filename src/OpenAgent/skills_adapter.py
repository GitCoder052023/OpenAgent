"""Native macOS and Daily Life Skills Adapter for OpenAgent.

Exposes high-leverage macOS CLI tools to Commercial Instinct over WhatsApp:
1. apple-reminders via remindctl CLI (list, add, complete, delete)
2. imsg via imsg CLI (list chats, search history, send iMessage/SMS)
3. things-mac via things CLI (Things 3 inbox, today, search, add)
4. spotify-player via spogo CLI (search, play, pause, next, prev, status)
5. 1password via op CLI (item get, read credential)
6. peekaboo via peekaboo CLI (macOS screen capture & UI driving)
7. nano-pdf via nano-pdf CLI (natural-language PDF page editing)
8. camsnap via camsnap CLI (security camera snapshots)
9. apple-notes via native AppleScript (create and list notes)
10. tmux (sessions, send keys, capture pane)
"""

import json
import logging
import os
import shutil
import subprocess
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("openagent.skills")

SKILL_CATALOG = {
    "apple_reminders": {
        "bin": "remindctl",
        "brew": "brew install steipete/tap/remindctl",
        "description": "Manage Apple Reminders natively from CLI (synced with iPhone/iPad)",
    },
    "imsg": {
        "bin": "imsg",
        "brew": "brew install steipete/tap/imsg",
        "description": "Read and send iMessage/SMS via macOS Messages.app",
    },
    "things_mac": {
        "bin": "things",
        "brew": "go install github.com/ossianhempel/things3-cli/cmd/things@latest",
        "description": "Search, read, and create tasks in Things 3",
    },
    "spotify": {
        "bin": "spogo",
        "alt_bin": "spotify_player",
        "brew": "brew install steipete/tap/spogo",
        "description": "Control Spotify music playback, search tracks, and switch devices",
    },
    "1password": {
        "bin": "op",
        "brew": "brew install 1password-cli",
        "description": "Securely read credentials and items from 1Password",
    },
    "peekaboo": {
        "bin": "peekaboo",
        "brew": "brew install steipete/tap/peekaboo",
        "description": "Native macOS UI automation & screen element capture",
    },
    "nano_pdf": {
        "bin": "nano-pdf",
        "brew": "uv tool install nano-pdf",
        "description": "Edit PDF pages using natural language commands",
    },
    "camsnap": {
        "bin": "camsnap",
        "brew": "brew install steipete/tap/camsnap",
        "description": "Capture frames and clips from RTSP/ONVIF cameras",
    },
    "tmux": {
        "bin": "tmux",
        "brew": "brew install tmux",
        "description": "Manage persistent terminal sessions and background panes",
    },
    "apple_notes": {
        "bin": "osascript",
        "brew": "Native macOS (built-in)",
        "description": "Create and read Apple Notes directly via macOS AppleScript",
    },
}


class SkillsAdapter:
    """Dispatches calls to native macOS agent skills."""

    def __init__(self, skills_root: Optional[Path] = None):
        self.skills_root = skills_root or (Path.cwd() / "openagent" / "skills")

    def _run_cli(self, args: List[str], timeout: float = 5.0) -> Dict[str, Any]:
        """Execute a CLI tool and return standard dict."""
        cmd_name = args[0]
        bin_path = shutil.which(cmd_name)
        if not bin_path:
            info = SKILL_CATALOG.get(cmd_name, {})
            install_cmd = info.get("brew", f"Install '{cmd_name}'")
            return {
                "status": "error",
                "error": f"Tool '{cmd_name}' is not installed on this Mac. Please run: {install_cmd}",
                "install_hint": install_cmd,
            }

        try:
            res = subprocess.run(
                [bin_path] + args[1:],
                capture_output=True,
                text=True,
                timeout=timeout,
            )
            output = res.stdout.strip()
            err_output = res.stderr.strip()
            return {
                "status": "ok" if res.returncode == 0 else "error",
                "exit_code": res.returncode,
                "stdout": output,
                "stderr": err_output,
                "output": output or err_output,
            }
        except subprocess.TimeoutExpired:
            return {"status": "error", "error": f"Command '{cmd_name}' timed out after {timeout}s"}
        except Exception as exc:
            return {"status": "error", "error": f"Failed to execute '{cmd_name}': {exc}"}

    # -------------------------------------------------------------------------
    # 1. Apple Reminders (remindctl)
    # -------------------------------------------------------------------------
    def reminders(self, action: str = "list", **kwargs) -> Dict[str, Any]:
        """Manage Apple Reminders. Actions: list, add, complete, delete."""
        action = action.lower()
        if action == "list":
            due = kwargs.get("due", "today")
            cmd = ["remindctl", "list", due, "--json"] if due else ["remindctl", "list", "--json"]
            return self._run_cli(cmd)
        elif action == "add":
            title = kwargs.get("title") or kwargs.get("text")
            if not title:
                return {"status": "error", "error": "Missing 'title' for reminder"}
            cmd = ["remindctl", "add", str(title)]
            if kwargs.get("due"):
                cmd.extend(["--due", str(kwargs.get("due"))])
            if kwargs.get("list"):
                cmd.extend(["--list", str(kwargs.get("list"))])
            if kwargs.get("notes"):
                cmd.extend(["--notes", str(kwargs.get("notes"))])
            return self._run_cli(cmd)
        elif action == "complete":
            item_id = kwargs.get("id") or kwargs.get("item_id")
            if not item_id:
                return {"status": "error", "error": "Missing 'id' to complete reminder"}
            return self._run_cli(["remindctl", "complete", str(item_id)])
        elif action == "delete":
            item_id = kwargs.get("id") or kwargs.get("item_id")
            if not item_id:
                return {"status": "error", "error": "Missing 'id' to delete reminder"}
            return self._run_cli(["remindctl", "delete", str(item_id)])
        else:
            return {"status": "error", "error": f"Unknown reminders action '{action}'. Use list, add, complete, delete."}

    # -------------------------------------------------------------------------
    # 2. iMessage & SMS (imsg)
    # -------------------------------------------------------------------------
    def imessage(self, action: str = "send", **kwargs) -> Dict[str, Any]:
        """Read and send iMessage/SMS. Actions: send, list, history."""
        action = action.lower()
        if action == "send":
            to = kwargs.get("to") or kwargs.get("recipient")
            text = kwargs.get("text") or kwargs.get("message")
            if not to or not text:
                return {"status": "error", "error": "Missing 'to' or 'text' for imessage send"}
            return self._run_cli(["imsg", "send", str(to), str(text)])
        elif action in ("list", "chats"):
            limit = str(kwargs.get("limit", 10))
            return self._run_cli(["imsg", "chats", "--limit", limit])
        elif action in ("history", "messages"):
            to = kwargs.get("to") or kwargs.get("chat")
            limit = str(kwargs.get("limit", 15))
            cmd = ["imsg", "history", "--limit", limit]
            if to:
                cmd.append(str(to))
            return self._run_cli(cmd)
        return {"status": "error", "error": f"Unknown imessage action '{action}'. Use send, list, history."}

    # -------------------------------------------------------------------------
    # 3. Things 3 (things-mac)
    # -------------------------------------------------------------------------
    def things3(self, action: str = "today", **kwargs) -> Dict[str, Any]:
        """Manage Things 3 tasks. Actions: today, inbox, upcoming, search, add."""
        action = action.lower()
        if action in ("today", "inbox", "upcoming"):
            return self._run_cli(["things", action])
        elif action == "search":
            query = kwargs.get("query") or kwargs.get("q")
            if not query:
                return {"status": "error", "error": "Missing 'query' for things search"}
            return self._run_cli(["things", "search", str(query)])
        elif action == "add":
            title = kwargs.get("title") or kwargs.get("text")
            if not title:
                return {"status": "error", "error": "Missing 'title' for things add"}
            cmd = ["things", "add", str(title)]
            if kwargs.get("notes"):
                cmd.extend(["--notes", str(kwargs.get("notes"))])
            if kwargs.get("list"):
                cmd.extend(["--list", str(kwargs.get("list"))])
            if kwargs.get("when"):
                cmd.extend(["--when", str(kwargs.get("when"))])
            return self._run_cli(cmd)
        return {"status": "error", "error": f"Unknown things action '{action}'. Use today, inbox, upcoming, search, add."}

    # -------------------------------------------------------------------------
    # 4. Spotify Player (spogo / spotify_player)
    # -------------------------------------------------------------------------
    def _run_applescript(self, script: str, timeout: float = 5.0) -> Dict[str, Any]:
        """Execute an AppleScript snippet silently via osascript without activating any window."""
        try:
            res = subprocess.run(["osascript", "-e", script], capture_output=True, text=True, timeout=timeout)
            output = res.stdout.strip()
            err_output = res.stderr.strip()
            return {
                "status": "ok" if res.returncode == 0 else "error",
                "exit_code": res.returncode,
                "stdout": output,
                "stderr": err_output,
                "output": output or err_output,
                "background_isolated": True,
            }
        except subprocess.TimeoutExpired:
            return {"status": "error", "error": f"AppleScript timed out after {timeout}s"}
        except Exception as exc:
            return {"status": "error", "error": f"Failed to execute AppleScript: {exc}"}

    def spotify(self, action: str = "status", **kwargs) -> Dict[str, Any]:
        """Control Spotify music playback. Actions: play, pause, next, prev, status, search."""
        action = action.lower()
        spogo_bin = shutil.which("spogo")
        spot_bin = spogo_bin or shutil.which("spotify_player")

        if not spot_bin:
            # Native macOS AppleScript fallback over Apple Events (Zero Focus Steal)
            if action in ("play", "start"):
                return self._run_applescript('tell application "Spotify" to play')
            elif action in ("pause", "stop"):
                return self._run_applescript('tell application "Spotify" to pause')
            elif action in ("toggle", "playpause"):
                return self._run_applescript('tell application "Spotify" to playpause')
            elif action in ("next", "skip"):
                return self._run_applescript('tell application "Spotify" to next track')
            elif action in ("prev", "previous", "back"):
                return self._run_applescript('tell application "Spotify" to previous track')
            elif action == "status":
                script = (
                    'tell application "System Events"\n'
                    '    if not (exists (first process whose name is "Spotify")) then return "Spotify is not running"\n'
                    'end tell\n'
                    'tell application "Spotify"\n'
                    '    if player state is playing then\n'
                    '        return "Playing: " & name of current track & " by " & artist of current track\n'
                    '    else\n'
                    '        return "Paused"\n'
                    '    end if\n'
                    'end tell'
                )
                return self._run_applescript(script)
            elif action == "search":
                return {
                    "status": "error",
                    "error": "Advanced search requires 'spogo' or 'spotify_player'. Run: brew install steipete/tap/spogo. Standard playback (play, pause, next, prev, status) is active via native Apple Events.",
                }
            return {
                "status": "error",
                "error": f"Action '{action}' requires spogo CLI or standard playback actions (play, pause, next, prev, status).",
            }

        is_spogo = bool(spogo_bin)
        if action in ("play", "pause", "next", "prev", "previous", "status"):
            act_cmd = "prev" if action == "previous" else action
            return self._run_cli(["spogo" if is_spogo else "spotify_player", "playback" if not is_spogo else "", act_cmd])
        elif action == "search":
            query = kwargs.get("query") or kwargs.get("q")
            if not query:
                return {"status": "error", "error": "Missing 'query' for spotify search"}
            if is_spogo:
                return self._run_cli(["spogo", "search", "track", str(query)])
            else:
                return self._run_cli(["spotify_player", "search", str(query)])
        elif action == "device":
            return self._run_cli(["spogo" if is_spogo else "spotify_player", "device", "list"])
        return {"status": "error", "error": f"Unknown spotify action '{action}'."}

    def music(self, action: str = "status", **kwargs) -> Dict[str, Any]:
        """Control Apple Music (Music.app) playback silently via Apple Events without focus loss."""
        action = action.lower()
        if action in ("play", "start"):
            return self._run_applescript('tell application "Music" to play')
        elif action in ("pause", "stop"):
            return self._run_applescript('tell application "Music" to pause')
        elif action in ("toggle", "playpause"):
            return self._run_applescript('tell application "Music" to playpause')
        elif action in ("next", "skip"):
            return self._run_applescript('tell application "Music" to next track')
        elif action in ("prev", "previous", "back"):
            return self._run_applescript('tell application "Music" to previous track')
        elif action == "status":
            script = (
                'tell application "System Events"\n'
                '    if not (exists (first process whose name is "Music")) then return "Music is not running"\n'
                'end tell\n'
                'tell application "Music"\n'
                '    if player state is playing then\n'
                '        return "Playing: " & name of current track & " by " & artist of current track\n'
                '    else\n'
                '        return "Paused"\n'
                '    end if\n'
                'end tell'
            )
            return self._run_applescript(script)
        return {"status": "error", "error": f"Unknown music action '{action}'."}

    # -------------------------------------------------------------------------
    # 5. 1Password (op)
    # -------------------------------------------------------------------------
    def onepassword(self, action: str = "get", **kwargs) -> Dict[str, Any]:
        """Retrieve items securely from 1Password. Actions: get, list, read."""
        action = action.lower()
        if action == "get":
            item = kwargs.get("item") or kwargs.get("name")
            if not item:
                return {"status": "error", "error": "Missing 'item' name or ID for 1Password"}
            return self._run_cli(["op", "item", "get", str(item), "--format", "json"])
        elif action == "list":
            return self._run_cli(["op", "item", "list", "--format", "json"])
        elif action == "read":
            ref = kwargs.get("reference") or kwargs.get("ref")
            if not ref:
                return {"status": "error", "error": "Missing secret 'reference' (e.g. op://vault/item/field)"}
            return self._run_cli(["op", "read", str(ref)])
        return {"status": "error", "error": f"Unknown 1password action '{action}'."}

    # -------------------------------------------------------------------------
    # 6. Peekaboo (peekaboo)
    # -------------------------------------------------------------------------
    def peekaboo(self, action: str = "image", **kwargs) -> Dict[str, Any]:
        """Drive macOS UI via Peekaboo CLI. Actions: image, list, click, type."""
        action = action.lower()
        if action == "image":
            out_path = kwargs.get("out") or "/tmp/peekaboo_snap.png"
            return self._run_cli(["peekaboo", "image", "--output", str(out_path)])
        elif action == "list":
            target = kwargs.get("target", "apps")
            return self._run_cli(["peekaboo", "list", str(target), "--json"])
        elif action == "click":
            target = kwargs.get("target") or kwargs.get("coords")
            if not target:
                return {"status": "error", "error": "Missing click 'target'"}
            return self._run_cli(["peekaboo", "click", str(target)])
        elif action == "type":
            text = kwargs.get("text")
            if text is None:
                return {"status": "error", "error": "Missing 'text' to type"}
            return self._run_cli(["peekaboo", "type", str(text)])
        return {"status": "error", "error": f"Unknown peekaboo action '{action}'."}

    # -------------------------------------------------------------------------
    # 7. Apple Notes (osascript native)
    # -------------------------------------------------------------------------
    def apple_notes(self, action: str = "create", **kwargs) -> Dict[str, Any]:
        """Create or search Apple Notes using native macOS AppleScript."""
        action = action.lower()
        if action == "create":
            title = kwargs.get("title", "New Note")
            body = kwargs.get("body", "")
            escaped_body = f"<h1>{title}</h1><br><p>{body}</p>".replace('"', '\\"')
            script = f'''
            tell application "Notes"
                make new note at folder "Notes" with properties {{name:"{title}", body:"{escaped_body}"}}
            end tell
            '''
            return self._run_cli(["osascript", "-e", script])
        elif action in ("list", "search"):
            script = '''
            tell application "Notes"
                set noteList to {}
                repeat with n in (notes of folder "Notes")
                    copy (name of n) to end of noteList
                end repeat
                return noteList
            end tell
            '''
            return self._run_cli(["osascript", "-e", script])
        return {"status": "error", "error": f"Unknown apple_notes action '{action}'."}

    # -------------------------------------------------------------------------
    # Catalog Inspection
    # -------------------------------------------------------------------------
    def list_skills(self) -> List[Dict[str, Any]]:
        """Return catalog of skills with live availability status on this Mac."""
        result = []
        for name, meta in SKILL_CATALOG.items():
            primary_bin = meta.get("bin", "")
            alt_bin = meta.get("alt_bin", "")
            is_installed = bool(shutil.which(primary_bin) or (alt_bin and shutil.which(alt_bin)))
            result.append({
                "skill": name,
                "installed": is_installed,
                "binary": primary_bin,
                "description": meta.get("description"),
                "install_instruction": meta.get("brew"),
            })
        return result


_DEFAULT_SKILLS_ADAPTER: Optional[SkillsAdapter] = None


def get_default_skills_adapter() -> SkillsAdapter:
    global _DEFAULT_SKILLS_ADAPTER
    if _DEFAULT_SKILLS_ADAPTER is None:
        _DEFAULT_SKILLS_ADAPTER = SkillsAdapter()
    return _DEFAULT_SKILLS_ADAPTER
