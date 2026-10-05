"""Connection channel between OpenAgent and the headless harness.

Spawns the headless execution harness over stdio IPC and exposes type-safe operational tools:
- bash: Execute shell commands with timeout and output capture
- read: Read files with pagination or directory listings
- write: Atomic file writing
- edit: Exact chunk search-and-replace with unified diff output
- grep: Ripgrep fast pattern search
- glob: File matching
- system_info: System environment details
- applescript: Native macOS AppleScript execution (Mac-specific operational superpower)
"""

import atexit
import json
import logging
import os
import selectors
import subprocess
import threading
from pathlib import Path
from typing import Any, Dict, Optional

logger = logging.getLogger("openagent.harness")


class HarnessError(Exception):
    """Raised when a harness tool call fails."""
    pass


class Harness:
    """Manages the lifecycle of the headless harness stdio IPC process."""

    def __init__(
        self,
        harness_root: Optional[Path] = None,
        opencode_root: Optional[Path] = None,
    ):
        root = harness_root or opencode_root
        if root is None:
            src_dir = Path(__file__).resolve().parent.parent
            if (src_dir / "tools" / "cli-harness").exists():
                self.root = src_dir / "tools" / "cli-harness"
            elif (src_dir / "cli-harness").exists():
                self.root = src_dir / "cli-harness"
            elif (src_dir / "harness").exists():
                self.root = src_dir / "harness"
            elif (src_dir.parent / "tools" / "cli-harness").exists():
                self.root = src_dir.parent / "tools" / "cli-harness"
            elif (src_dir.parent / "cli-harness").exists():
                self.root = src_dir.parent / "cli-harness"
            elif (src_dir.parent / "harness").exists():
                self.root = src_dir.parent / "harness"
            else:
                self.root = src_dir / "tools" / "cli-harness"
        else:
            self.root = Path(root)

        self.script_path = self.root / "harness-bridge.ts"
        if not self.script_path.exists():
            raise FileNotFoundError(f"Harness bridge script not found at {self.script_path}")

        if self.root.parent.name in ("tools", "src"):
            self.project_root = self.root.parent.parent if self.root.parent.parent.name != "" else self.root.parent
            if self.root.parent.name == "tools" and self.root.parent.parent.name == "src":
                self.project_root = self.root.parent.parent.parent
        else:
            self.project_root = self.root.parent

        self._proc: Optional[subprocess.Popen] = None
        self._lock = threading.Lock()
        self._seq = 0
        self._start_process()
        atexit.register(self.close)

    def _start_process(self):
        """Spawns the headless Bun harness process."""
        cmd = ["bun", "run", str(self.script_path)]
        self._proc = subprocess.Popen(
            cmd,
            cwd=str(self.project_root),
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,  # Line buffered
        )

        # Read the initial startup signal from stderr in a separate non-blocking check
        def drain_stderr():
            if self._proc and self._proc.stderr:
                for line in self._proc.stderr:
                    logger.debug("[Harness STDERR] %s", line.strip())

        threading.Thread(target=drain_stderr, daemon=True).start()

    def _kill_process(self):
        """Forcefully terminates the child process if running."""
        if self._proc:
            try:
                self._proc.kill()
                self._proc.wait(timeout=1)
            except Exception:
                pass
            self._proc = None

    def _call(self, tool: str, args: Dict[str, Any], timeout: float = 65.0) -> Any:
        """Sends a single JSON-RPC message over stdin and parses the response with deadlock protection."""
        with self._lock:
            if self._proc is None or self._proc.poll() is not None:
                self._start_process()

            self._seq += 1
            call_id = self._seq
            payload = json.dumps({"id": call_id, "tool": tool, "args": args})

            try:
                assert self._proc and self._proc.stdin and self._proc.stdout
                self._proc.stdin.write(payload + "\n")
                self._proc.stdin.flush()

                sel = selectors.DefaultSelector()
                sel.register(self._proc.stdout, selectors.EVENT_READ)
                events = sel.select(timeout=timeout)
                sel.close()

                if not events:
                    self._kill_process()
                    raise HarnessError(f"Harness IPC timed out after {timeout}s waiting for '{tool}' response")

                response_line = self._proc.stdout.readline()
                if not response_line:
                    raise HarnessError("Harness process closed the connection pipe.")

                res = json.loads(response_line)
                if res.get("status") == "error":
                    raise HarnessError(res.get("error", "Unknown harness error"))
                return res.get("result")
            except Exception as exc:
                if not isinstance(exc, HarnessError):
                    raise HarnessError(f"Harness IPC communication failed: {exc}") from exc
                raise

    # 1. Shell Execution
    def bash(self, command: str, cwd: Optional[str] = None, timeout_ms: int = 60000) -> Dict[str, Any]:
        """Execute a shell command via macOS zsh."""
        args: Dict[str, Any] = {"command": command, "timeout_ms": timeout_ms}
        if cwd:
            args["cwd"] = cwd
        # Allow bash timeout to trigger on subprocess before IPC channel timeout
        ipc_timeout = (timeout_ms / 1000.0) + 5.0
        return self._call("bash", args, timeout=ipc_timeout)

    # 2. File Reading & Directory Listing
    def read(self, path: str, offset: Optional[int] = None, limit: Optional[int] = None) -> Dict[str, Any]:
        """Read a file or directory with optional pagination."""
        args: Dict[str, Any] = {"path": path}
        if offset is not None:
            args["offset"] = offset
        if limit is not None:
            args["limit"] = limit
        return self._call("read", args)

    # 3. File Writing
    def write(self, path: str, content: str) -> Dict[str, Any]:
        """Write content atomically to a file."""
        return self._call("write", {"path": path, "content": content})

    # 4. Exact Chunk Replace & Diff
    def edit(
        self,
        path: str,
        old_string: str,
        new_string: str,
        replace_all: bool = False,
    ) -> Dict[str, Any]:
        """Exact string replacement with unified diff output."""
        return self._call(
            "edit",
            {
                "path": path,
                "oldString": old_string,
                "newString": new_string,
                "replaceAll": replace_all,
            },
        )

    # 5. Ripgrep Search
    def grep(self, pattern: str, path: str = ".", include: Optional[str] = None) -> Dict[str, Any]:
        """Search regex pattern in file contents using ripgrep."""
        args: Dict[str, Any] = {"pattern": pattern, "path": path}
        if include:
            args["include"] = include
        return self._call("grep", args)

    # 6. Glob File Search
    def glob(self, pattern: str, path: str = ".") -> Dict[str, Any]:
        """Search files matching a glob pattern."""
        return self._call("glob", {"pattern": pattern, "path": path})

    # 7. System Information
    def system_info(self) -> Dict[str, Any]:
        """Retrieve OS and node environment details."""
        return self._call("system_info", {})

    # 8. Native Mac Operational Extension (AppleScript / JXA)
    def applescript(self, script: str) -> str:
        """Run an AppleScript via osascript stdin for native Mac automation."""
        res = self._call("applescript", {"script": script})
        return res["output"].strip()

    # 9. Instructions (Global and project instructions)
    def instructions(self, directory: Optional[str] = None) -> Dict[str, Any]:
        """Load global and project instructions (AGENTS.md, CLAUDE.md, CONTEXT.md)."""
        args: Dict[str, Any] = {}
        if directory:
            args["directory"] = directory
        return self._call("instructions", args)

    # 10. System Prompts & Agent Specifications
    def system_prompt(self, model: str = "default", agent: Optional[str] = None) -> Dict[str, Any]:
        """Retrieve battle-tested system prompt and agent definitions."""
        args: Dict[str, Any] = {"model": model}
        if agent:
            args["agent"] = agent
        return self._call("system_prompt", args)

    def close(self):
        """Terminate the harness subprocess."""
        if not hasattr(self, "_lock") or self._lock is None:
            return
        with self._lock:
            if self._proc and self._proc.poll() is None:
                self._proc.terminate()
                try:
                    self._proc.wait(timeout=2)
                except subprocess.TimeoutExpired:
                    self._kill_process()
            self._proc = None

    def __del__(self):
        self.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()


# Backward compatibility alias
OpenCodeHarness = Harness

__all__ = ["Harness", "OpenCodeHarness", "HarnessError"]
