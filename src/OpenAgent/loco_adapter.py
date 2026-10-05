"""LocoAgent Social Media Automation Adapter for OpenAgent.

Integrates the production-grade LocoAgent CDP social media automation engine
directly into OpenAgent. Enables external intelligence (Jarvis / Instinct) to:
- Control persistent, anti-detection Chrome browser sessions across social platforms
  (X/Twitter, LinkedIn, Reddit, Instagram, Facebook, Threads, YouTube, TikTok, GitHub)
- Execute deterministic automation workflows and background daemons (e.g. daily paper posting, search & reply)
- Perform atomic social actions (post updates, reply, like, repost, follow, search)
- Maintain cross-session deduplication via the persistent operation log
- Capture annotated screenshots of social feeds and verify post publishing over WhatsApp
- Run end-to-end autonomous social missions via LocoAgent's agentic loop
"""

from __future__ import annotations

import json
import logging
import os
import re
import shutil
import subprocess
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

logger = logging.getLogger("openagent.loco_adapter")

# Platforms supported out of the box with dedicated CDP ports
DEFAULT_TARGET_PORTS = {
    "x": 9222,
    "twitter": 9222,
    "linkedin": 9223,
    "reddit": 9224,
    "instagram": 9225,
    "facebook": 9226,
    "threads": 9227,
    "youtube": 9228,
    "tiktok": 9229,
    "github": 9230,
}

PROHIBITED_DOMAINS = {
    "web.whatsapp.com",
    "whatsapp.com",
    "api.whatsapp.com",
}

PLATFORM_HOME_URLS = {
    "threads": "https://www.threads.net",
    "reddit": "https://www.reddit.com",
    "x": "https://x.com/home",
    "twitter": "https://x.com/home",
    "linkedin": "https://www.linkedin.com/feed",
    "instagram": "https://www.instagram.com",
    "facebook": "https://www.facebook.com",
    "youtube": "https://www.youtube.com",
    "tiktok": "https://www.tiktok.com",
    "github": "https://github.com",
}


class LocoError(Exception):
    """Raised when a LocoAgent operation fails."""
    pass


class LocoAdapter:
    """High-level adapter wrapping LocoAgent for OpenAgent and WhatsApp dispatch."""

    def __init__(self, root: Optional[Path] = None, timeout: float = 120.0):
        if root is None:
            # src/OpenAgent -> src/tools/locoagent
            here = Path(__file__).resolve().parent
            candidate = here.parent / "tools" / "locoagent"
            if not candidate.exists():
                candidate = here.parent.parent / "src" / "tools" / "locoagent"
            self.root = candidate
        else:
            self.root = Path(root)

        self.timeout = timeout
        self.bun_bin = shutil.which("bun") or "/opt/homebrew/bin/bun"
        self.agent_browser_bin = shutil.which("agent-browser") or "/opt/homebrew/bin/agent-browser"
        self._targets_cache: Optional[Dict[str, Any]] = None

    def _ensure_loco_exists(self) -> None:
        if not self.root.exists() or not (self.root / "package.json").exists():
            raise LocoError(f"LocoAgent root directory not found at: {self.root}")

    def _run_bun(self, args: List[str], timeout: Optional[float] = None) -> Dict[str, Any]:
        """Run a command using Bun inside the LocoAgent project directory."""
        self._ensure_loco_exists()
        cmd = [self.bun_bin] + args
        eff_timeout = timeout or self.timeout
        try:
            proc = subprocess.run(
                cmd,
                cwd=str(self.root),
                capture_output=True,
                text=True,
                timeout=eff_timeout,
            )
            return {
                "status": "ok" if proc.returncode == 0 else "error",
                "exit_code": proc.returncode,
                "stdout": proc.stdout.strip(),
                "stderr": proc.stderr.strip(),
            }
        except subprocess.TimeoutExpired as exc:
            return {
                "status": "error",
                "exit_code": -1,
                "error": f"Command timed out after {eff_timeout}s: {' '.join(cmd)}",
                "stdout": (exc.stdout or "").strip() if isinstance(exc.stdout, str) else "",
                "stderr": (exc.stderr or "").strip() if isinstance(exc.stderr, str) else "",
            }
        except Exception as exc:
            return {
                "status": "error",
                "exit_code": -1,
                "error": str(exc),
                "stdout": "",
                "stderr": "",
            }

    # -----------------------------------------------------------------------
    # 1. Target & Port Resolution
    # -----------------------------------------------------------------------
    def get_targets(self) -> Dict[str, Dict[str, Any]]:
        """Load configured browser targets from browser-targets.json."""
        targets_file = self.root / "config" / "browser-targets.json"
        if targets_file.exists():
            try:
                with open(targets_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    return data.get("targets", {})
            except Exception as exc:
                logger.warning("Could not read browser-targets.json: %s", exc)
        return {k: {"cdpPort": v} for k, v in DEFAULT_TARGET_PORTS.items()}

    def get_port_for_platform(self, platform: str) -> int:
        """Resolve the CDP port for a given social media platform."""
        plat = platform.strip().lower()
        if plat == "twitter":
            plat = "x"
        targets = self.get_targets()
        if plat in targets and "cdpPort" in targets[plat]:
            return int(targets[plat]["cdpPort"])
        if plat in DEFAULT_TARGET_PORTS:
            return DEFAULT_TARGET_PORTS[plat]
        return 9222

    def is_cdp_up(self, platform: str) -> bool:
        """Check if Chrome's CDP endpoint is responding for this platform."""
        port = self.get_port_for_platform(platform)
        url = f"http://127.0.0.1:{port}/json/version"
        try:
            req = urllib.request.Request(url, method="GET")
            with urllib.request.urlopen(req, timeout=1.5) as resp:
                return resp.status == 200
        except Exception:
            return False

    def list_targets_status(self) -> Dict[str, Any]:
        """List all supported social platforms and their live CDP connectivity."""
        targets = self.get_targets()
        status_map = {}
        for plat, info in targets.items():
            port = info.get("cdpPort", self.get_port_for_platform(plat))
            up = self.is_cdp_up(plat)
            status_map[plat] = {
                "cdp_port": port,
                "online": up,
                "proxy": info.get("proxy"),
                "account": info.get("account"),
            }
        return {
            "targets": status_map,
            "total": len(status_map),
            "online_count": sum(1 for v in status_map.values() if v["online"]),
        }

    # -----------------------------------------------------------------------
    # 2. Chrome Setup & Management
    # -----------------------------------------------------------------------
    def setup_chrome(self, target: str = "x", reset: bool = False, all_targets: bool = False) -> Dict[str, Any]:
        """Launch isolated, persistent Chrome for one or all platforms."""
        args = ["run", "scripts/setup-chrome.ts"]
        if all_targets:
            args.append("--all")
        else:
            target_clean = "x" if target.lower() == "twitter" else target.lower()
            args.extend(["--target", target_clean])
        if reset:
            args.append("--reset")

        res = self._run_bun(args, timeout=30.0)
        target_name = "all" if all_targets else target
        up = True if all_targets else self.is_cdp_up(target)
        return {
            "status": "ok" if res["exit_code"] == 0 or up else "error",
            "target": target_name,
            "cdp_online": up,
            "output": res["stdout"] or res["stderr"],
        }

    # -----------------------------------------------------------------------
    # 3. Direct agent-browser Execution
    # -----------------------------------------------------------------------
    def exec_agent_browser(self, platform: str, command: str, timeout: float = 35.0) -> Dict[str, Any]:
        """Execute an agent-browser command pinned to the target platform's CDP port."""
        port = self.get_port_for_platform(platform)
        if not self.is_cdp_up(platform):
            # Attempt to bring up Chrome automatically
            logger.info("Chrome CDP on port %s for platform '%s' is down. Attempting auto-launch...", port, platform)
            self.setup_chrome(target=platform)
            time.sleep(1.0)

        cmd = f"{self.agent_browser_bin} --cdp {port} {command}"
        try:
            proc = subprocess.run(
                cmd,
                shell=True,
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd=str(self.root),
            )
            out = proc.stdout.strip()
            err = proc.stderr.strip()
            return {
                "status": "ok" if proc.returncode == 0 else "error",
                "exit_code": proc.returncode,
                "output": out or err,
                "platform": platform,
                "cdp_port": port,
            }
        except subprocess.TimeoutExpired:
            return {
                "status": "error",
                "error": f"agent-browser command timed out after {timeout}s: {command}",
                "platform": platform,
                "cdp_port": port,
            }
        except Exception as exc:
            return {
                "status": "error",
                "error": str(exc),
                "platform": platform,
                "cdp_port": port,
            }

    # -----------------------------------------------------------------------
    # 4. Perception & Navigation Primitives
    # -----------------------------------------------------------------------
    def open_url(self, platform: str, url: str) -> Dict[str, Any]:
        """Navigate to a URL on the given platform."""
        for prohibited in PROHIBITED_DOMAINS:
            if prohibited in url.lower():
                raise LocoError(f"Targeting '{url}' is prohibited to protect bridge communication.")
        res = self.exec_agent_browser(platform, f"open \"{url}\"")
        return res

    def snapshot(self, platform: str, interactive: bool = True, selector: Optional[str] = None) -> Dict[str, Any]:
        """Perceive interactive elements on the page with @ref identifiers."""
        cmd = "snapshot -i -c" if interactive else "snapshot -c"
        if selector:
            cmd += f" -s '{selector}'"
        return self.exec_agent_browser(platform, cmd)

    def screenshot(self, platform: str, filename: Optional[str] = None, full: bool = False, annotate: bool = False) -> Dict[str, Any]:
        """Capture a screenshot of the current page and prepare it for WhatsApp delivery."""
        temp_dir = Path(tempfile.gettempdir()) / "openagent_social"
        temp_dir.mkdir(parents=True, exist_ok=True)
        if not filename:
            filename = f"social_{platform}_{int(time.time())}.png"
        out_path = temp_dir / filename

        cmd = "screenshot"
        if full:
            cmd += " --full"
        if annotate:
            cmd += " --annotate"
        cmd += f" \"{out_path}\""

        res = self.exec_agent_browser(platform, cmd)
        if res.get("status") == "ok" and out_path.exists():
            res["screenshot_path"] = str(out_path)
            res["_send_attachment"] = str(out_path)
        return res

    # -----------------------------------------------------------------------
    # 5. Operation Log & Anti-Duplication
    # -----------------------------------------------------------------------
    def check_dedup(self, platform: str, action: str, url: str) -> Dict[str, Any]:
        """Check if an action was already performed on this target URL."""
        res = self._run_bun([
            "run", "scripts/log-operation.ts", "check",
            "--platform", platform,
            "--action", action,
            "--url", url,
        ])
        is_done = (res["exit_code"] == 0)
        return {
            "status": "ok",
            "already_done": is_done,
            "platform": platform,
            "action": action,
            "url": url,
            "details": res["stdout"],
        }

    def log_action(self, platform: str, action: str, url: str, status: str = "success", note: str = "") -> Dict[str, Any]:
        """Record an operation in the persistent cross-session ledger."""
        args = [
            "run", "scripts/log-operation.ts", "add",
            "--platform", platform,
            "--action", action,
            "--url", url,
            "--status", status,
        ]
        if note:
            args.extend(["--note", note])
        res = self._run_bun(args)
        return {
            "status": "ok" if res["exit_code"] == 0 else "error",
            "logged": res["exit_code"] == 0,
            "details": res["stdout"],
        }

    def recent_operations(self, limit: int = 20) -> Dict[str, Any]:
        """Retrieve recent operations from the persistent ledger."""
        res = self._run_bun(["run", "scripts/log-operation.ts", "recent", "--limit", str(limit)])
        try:
            parsed = json.loads(res["stdout"]) if res["stdout"] else []
            return {"status": "ok", "operations": parsed, "count": len(parsed)}
        except Exception:
            return {"status": "ok", "raw": res["stdout"], "count": 0}

    def operation_summary(self, days: int = 7) -> str:
        """Get a compact summary of operations for prompt context."""
        res = self._run_bun(["run", "scripts/log-operation.ts", "summary", "--days", str(days)])
        return res.get("stdout", "")

    # -----------------------------------------------------------------------
    # 6. High-Level Social Operations (Playbook Sequences)
    # -----------------------------------------------------------------------
    def like_post(self, platform: str = "threads", post_url: str = "") -> Dict[str, Any]:
        """Like or upvote a post with automatic deduplication check."""
        plat = platform.lower()
        action_name = "upvote" if plat == "reddit" else "like"

        # 1. Dedup check
        chk = self.check_dedup(plat, action_name, post_url)
        if chk["already_done"]:
            return {
                "status": "ok",
                "skipped": True,
                "reason": f"Post already {action_name}d in operation log.",
                "url": post_url,
                "action": action_name,
            }

        # 2. Navigate to post
        nav = self.open_url(plat, post_url)
        if nav.get("status") != "ok":
            return nav

        time.sleep(1.5)

        # 3. Snapshot to find like/upvote button
        snap = self.snapshot(plat, interactive=True)
        snap_text = snap.get("output", "")

        ref = None
        for line in snap_text.splitlines():
            lower = line.lower()
            if plat == "reddit":
                if ("upvote" in lower or "vote" in lower or "like" in lower) and ("button" in lower or "role=button" in lower):
                    m = re.search(r"@e\d+", line)
                    if m:
                        ref = m.group(0)
                        break
            else:
                if "like" in lower and ("button" in lower or "role=button" in lower):
                    m = re.search(r"@e\d+", line)
                    if m:
                        ref = m.group(0)
                        break

        if not ref:
            return {
                "status": "error",
                "error": f"Could not identify {action_name} button on page.",
                "snapshot_preview": snap_text[:500],
            }

        # 4. Click like/upvote
        click_res = self.exec_agent_browser(plat, f"click {ref}")
        if click_res.get("status") == "ok":
            self.log_action(plat, action_name, post_url, status="success")
            return {
                "status": "ok",
                "action": action_name,
                "url": post_url,
                "ref_clicked": ref,
            }
        return click_res

    def reply_to_post(self, platform: str = "threads", post_url: str = "", text: str = "") -> Dict[str, Any]:
        """Reply to a post/thread or comment on Reddit with deduplication check and verification."""
        plat = platform.lower()
        action_name = "comment" if plat == "reddit" else "reply"
        chk = self.check_dedup(plat, action_name, post_url)
        if chk["already_done"]:
            return {
                "status": "ok",
                "skipped": True,
                "reason": f"Post already replied/commented in operation log.",
                "url": post_url,
                "action": action_name,
            }

        nav = self.open_url(plat, post_url)
        if nav.get("status") != "ok":
            return nav

        time.sleep(1.5)

        # Snapshot to find reply/comment textbox
        snap = self.snapshot(plat, interactive=True)
        snap_text = snap.get("output", "")

        textbox_ref = None
        for line in snap_text.splitlines():
            lower = line.lower()
            if any(k in lower for k in ("post your reply", "reply", "add a comment", "comment", "what are your thoughts")) and ("textbox" in lower or "contenteditable" in lower or "input" in lower):
                m = re.search(r"@e\d+", line)
                if m:
                    textbox_ref = m.group(0)
                    break

        # If on Threads and no textbox found directly, look for Reply button to open composer dialog
        if not textbox_ref and plat == "threads":
            for line in snap_text.splitlines():
                if ("button \"reply\"" in line.lower() or "reply" in line.lower()) and "button" in line.lower():
                    m = re.search(r"@e\d+", line)
                    if m:
                        self.exec_agent_browser(plat, f"click {m.group(0)}")
                        time.sleep(1.0)
                        snap = self.snapshot(plat, interactive=True)
                        snap_text = snap.get("output", "")
                        break
            for line in snap_text.splitlines():
                if "textbox" in line.lower() or "contenteditable" in line.lower():
                    m = re.search(r"@e\d+", line)
                    if m:
                        textbox_ref = m.group(0)
                        break

        # If on Reddit and no textbox found directly, look for "Add a comment" button to reveal comment box
        if not textbox_ref and plat == "reddit":
            for line in snap_text.splitlines():
                if "add a comment" in line.lower() and "button" in line.lower():
                    m = re.search(r"@e\d+", line)
                    if m:
                        self.exec_agent_browser(plat, f"click {m.group(0)}")
                        time.sleep(1.0)
                        snap = self.snapshot(plat, interactive=True)
                        snap_text = snap.get("output", "")
                        break
            for line in snap_text.splitlines():
                if "textbox" in line.lower() or "contenteditable" in line.lower():
                    m = re.search(r"@e\d+", line)
                    if m:
                        textbox_ref = m.group(0)
                        break

        if not textbox_ref:
            return {
                "status": "error",
                "error": f"Could not identify {action_name} textbox on page.",
                "snapshot_preview": snap_text[:500],
            }

        # Fill text
        clean_text = text.replace('"', '\\"')
        fill_res = self.exec_agent_browser(plat, f"fill {textbox_ref} \"{clean_text}\"")
        if fill_res.get("status") != "ok":
            return fill_res

        time.sleep(0.5)

        # Find submit button
        snap2 = self.snapshot(plat, interactive=True)
        submit_ref = None
        for line in snap2.get("output", "").splitlines():
            lower = line.lower()
            if any(b in lower for b in ("button \"reply\"", "button \"post\"", "button \"comment\"")):
                m = re.search(r"@e\d+", line)
                if m:
                    submit_ref = m.group(0)
                    break

        if not submit_ref:
            for line in snap2.get("output", "").splitlines():
                lower = line.lower()
                if ("reply" in lower or "comment" in lower or "post" in lower) and "button" in lower:
                    m = re.search(r"@e\d+", line)
                    if m:
                        submit_ref = m.group(0)
                        break

        if submit_ref:
            click_res = self.exec_agent_browser(plat, f"click {submit_ref}")
            if click_res.get("status") == "ok":
                time.sleep(1.5)
                self.log_action(plat, action_name, post_url, status="success", note=text[:80])
                shot = self.screenshot(plat, filename=f"{action_name}_sent_{int(time.time())}.png")
                return {
                    "status": "ok",
                    "action": action_name,
                    "url": post_url,
                    "reply_text": text,
                    "_send_attachment": shot.get("screenshot_path"),
                }

        return {
            "status": "error",
            "error": f"Failed to submit {action_name}.",
            "textbox_filled": True,
        }

    def post_content(
        self,
        platform: str = "threads",
        text: str = "",
        media_path: Optional[str] = None,
        title: Optional[str] = None,
        subreddit: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Post a new update to Threads, Reddit, X, etc."""
        plat = platform.lower()

        # --- REDDIT POST FLOW ---
        if plat == "reddit":
            if subreddit:
                submit_url = f"https://www.reddit.com/r/{subreddit}/submit"
            else:
                submit_url = "https://www.reddit.com/submit"
            nav = self.open_url(plat, submit_url)
            if nav.get("status") != "ok":
                return nav

            time.sleep(2.0)
            snap = self.snapshot(plat, interactive=True)
            snap_text = snap.get("output", "")

            # Split title and body
            if not title:
                if "\n" in text:
                    parts = text.strip().split("\n", 1)
                    post_title = parts[0].replace("Title:", "").strip()
                    post_body = parts[1].replace("Body:", "").strip()
                else:
                    post_title = text[:100].strip()
                    post_body = text.strip()
            else:
                post_title = title.strip()
                post_body = text.strip()

            # Find title input
            title_ref = None
            for line in snap_text.splitlines():
                lower = line.lower()
                if "title" in lower and ("textbox" in lower or "input" in lower or "textarea" in lower):
                    m = re.search(r"@e\d+", line)
                    if m:
                        title_ref = m.group(0)
                        break

            if title_ref:
                clean_title = post_title.replace('"', '\\"')
                self.exec_agent_browser(plat, f"fill {title_ref} \"{clean_title}\"")
                time.sleep(0.5)

            # Find body input
            snap_body = self.snapshot(plat, interactive=True)
            body_ref = None
            for line in snap_body.get("output", "").splitlines():
                lower = line.lower()
                if any(k in lower for k in ("text", "body", "markdown", "post")) and ("textbox" in lower or "contenteditable" in lower or "textarea" in lower) and line != title_ref:
                    m = re.search(r"@e\d+", line)
                    if m and m.group(0) != title_ref:
                        body_ref = m.group(0)
                        break

            if body_ref and post_body:
                clean_body = post_body.replace('"', '\\"')
                self.exec_agent_browser(plat, f"fill {body_ref} \"{clean_body}\"")
                time.sleep(0.5)

            # Upload media if specified
            if media_path and os.path.exists(media_path):
                file_input_ref = None
                snap_file = self.snapshot(plat, interactive=False)
                for line in snap_file.get("output", "").splitlines():
                    if 'input[type="file"]' in line or 'file input' in line.lower():
                        m = re.search(r"@e\d+", line)
                        if m:
                            file_input_ref = m.group(0)
                            break
                if file_input_ref:
                    self.exec_agent_browser(plat, f"fill {file_input_ref} \"{media_path}\"")
                    time.sleep(2.0)

            # Find Post submit button
            snap_post = self.snapshot(plat, interactive=True)
            post_btn_ref = None
            for line in snap_post.get("output", "").splitlines():
                lower = line.lower()
                if any(k in lower for k in ('button "post"', 'button "publish"')):
                    m = re.search(r"@e\d+", line)
                    if m:
                        post_btn_ref = m.group(0)
                        break

            if post_btn_ref:
                self.exec_agent_browser(plat, f"click {post_btn_ref}")
                time.sleep(2.5)
                shot = self.screenshot(plat, filename=f"reddit_post_{int(time.time())}.png")
                self.log_action(plat, "post", submit_url, status="success", note=post_title[:80])
                return {
                    "status": "ok",
                    "action": "post",
                    "platform": "reddit",
                    "title": post_title,
                    "text": post_body,
                    "subreddit": subreddit or "global",
                    "_send_attachment": shot.get("screenshot_path"),
                }

            return {"status": "error", "error": "Could not find final Post button on Reddit."}

        # --- THREADS / X / OTHER PLATFORMS ---
        home_url = PLATFORM_HOME_URLS.get(plat, f"https://{plat}.com")
        nav = self.open_url(plat, home_url)
        if nav.get("status") != "ok":
            return nav

        time.sleep(2.0)
        snap = self.snapshot(plat, interactive=True)
        snap_text = snap.get("output", "")

        compose_ref = None
        for line in snap_text.splitlines():
            lower = line.lower()
            if any(k in lower for k in ("what's new", "start a thread", "what is happening", "what's happening", "start a post", "create a post")) or ("textbox" in lower and "post" in lower):
                m = re.search(r"@e\d+", line)
                if m:
                    compose_ref = m.group(0)
                    break

        if not compose_ref:
            # Try clicking the global Create / Post action button
            for line in snap_text.splitlines():
                lower = line.lower()
                if any(b in lower for b in ('button "create"', 'button "post"', 'button "new post"', 'button "start a thread"')):
                    m = re.search(r"@e\d+", line)
                    if m:
                        self.exec_agent_browser(plat, f"click {m.group(0)}")
                        time.sleep(1.0)
                        snap = self.snapshot(plat, interactive=True)
                        snap_text = snap.get("output", "")
                        break

            for line in snap_text.splitlines():
                if "textbox" in line.lower() or "contenteditable" in line.lower():
                    m = re.search(r"@e\d+", line)
                    if m:
                        compose_ref = m.group(0)
                        break

        if not compose_ref:
            return {"status": "error", "error": f"Could not find compose box on {plat}."}

        clean_text = text.replace('"', '\\"')
        self.exec_agent_browser(plat, f"fill {compose_ref} \"{clean_text}\"")
        time.sleep(0.5)

        # Upload media if specified
        if media_path and os.path.exists(media_path):
            file_input_ref = None
            snap_file = self.snapshot(plat, interactive=False)
            for line in snap_file.get("output", "").splitlines():
                if 'input[type="file"]' in line or 'file input' in line.lower():
                    m = re.search(r"@e\d+", line)
                    if m:
                        file_input_ref = m.group(0)
                        break
            if file_input_ref:
                self.exec_agent_browser(plat, f"fill {file_input_ref} \"{media_path}\"")
                time.sleep(2.0)

        # Click final Post button
        snap3 = self.snapshot(plat, interactive=True)
        post_btn_ref = None
        for line in snap3.get("output", "").splitlines():
            lower = line.lower()
            if any(k in lower for k in ('button "post"', 'button "tweet"', 'button "publish"')):
                m = re.search(r"@e\d+", line)
                if m:
                    post_btn_ref = m.group(0)
                    break

        if post_btn_ref:
            res = self.exec_agent_browser(plat, f"click {post_btn_ref}")
            time.sleep(2.0)
            shot = self.screenshot(plat, filename=f"post_{plat}_{int(time.time())}.png")
            self.log_action(plat, "post", home_url, status="success", note=text[:80])
            return {
                "status": "ok",
                "action": "post",
                "platform": plat,
                "text": text,
                "_send_attachment": shot.get("screenshot_path"),
            }

        return {"status": "error", "error": f"Could not find final Post button on {plat}."}

    def search(self, platform: str = "threads", query: str = "", tab: str = "latest", subreddit: Optional[str] = None) -> Dict[str, Any]:
        """Search Threads, Reddit, X, etc. for a keyword or topic and extract results."""
        plat = platform.lower()
        encoded = urllib.parse.quote(query)

        if plat == "threads":
            url = f"https://www.threads.net/search?q={encoded}&serp_type=default"
        elif plat == "reddit":
            if subreddit:
                url = f"https://www.reddit.com/r/{subreddit}/search/?q={encoded}&restrict_sr=1&sort=new"
            else:
                url = f"https://www.reddit.com/search/?q={encoded}&sort=new"
        elif plat in ("x", "twitter"):
            f_param = "&f=live" if tab.lower() == "latest" else ""
            url = f"https://x.com/search?q={encoded}{f_param}"
        elif plat == "linkedin":
            url = f"https://www.linkedin.com/search/results/content/?keywords={encoded}&sortBy=%22date_posted%22"
        else:
            url = f"https://{plat}.com/search?q={encoded}"

        nav = self.open_url(plat, url)
        if nav.get("status") != "ok":
            return nav

        time.sleep(2.5)
        snap = self.snapshot(plat, interactive=True)
        shot = self.screenshot(plat, filename=f"search_{plat}_{int(time.time())}.png")

        return {
            "status": "ok",
            "platform": plat,
            "query": query,
            "url": url,
            "results_preview": snap.get("output", "")[:2000],
            "_send_attachment": shot.get("screenshot_path"),
        }

    # -----------------------------------------------------------------------
    # 7. Workflow Engine & Daemons
    # -----------------------------------------------------------------------
    def workflow_list(self) -> Dict[str, Any]:
        """List all registered automation pipelines."""
        res = self._run_bun(["run", "scripts/workflow-engine.ts", "list"])
        return {
            "status": "ok" if res["exit_code"] == 0 else "error",
            "output": res["stdout"],
        }

    def workflow_status(self, workflow_id: Optional[str] = None) -> Dict[str, Any]:
        """Get status of a specific workflow or all workflows."""
        args = ["run", "scripts/workflow-engine.ts", "status"]
        if workflow_id:
            args.extend(["--id", workflow_id])
        res = self._run_bun(args)
        return {
            "status": "ok" if res["exit_code"] == 0 else "error",
            "output": res["stdout"],
        }

    def workflow_run(self, workflow_id: str) -> Dict[str, Any]:
        """Run a workflow pipeline synchronously (blocking)."""
        res = self._run_bun(["run", "scripts/workflow-engine.ts", "run", "--id", workflow_id], timeout=300.0)
        return {
            "status": "ok" if res["exit_code"] == 0 else "error",
            "workflow_id": workflow_id,
            "output": res["stdout"] or res["stderr"],
        }

    def workflow_start(self, workflow_id: str) -> Dict[str, Any]:
        """Start a workflow pipeline in the background."""
        res = self._run_bun(["run", "scripts/workflow-engine.ts", "start", "--id", workflow_id])
        return {
            "status": "ok" if res["exit_code"] == 0 else "error",
            "workflow_id": workflow_id,
            "output": res["stdout"],
        }

    def workflow_daemon(self, workflow_id: str, interval: int = 60) -> Dict[str, Any]:
        """Schedule a workflow as a recurring daemon (runs every N minutes)."""
        res = self._run_bun(["run", "scripts/workflow-engine.ts", "daemon", "--id", workflow_id, "--interval", str(interval)])
        return {
            "status": "ok" if res["exit_code"] == 0 else "error",
            "workflow_id": workflow_id,
            "interval_minutes": interval,
            "output": res["stdout"],
        }

    def workflow_stop(self, workflow_id: str) -> Dict[str, Any]:
        """Halt a running background workflow at its next checkpoint."""
        res = self._run_bun(["run", "scripts/workflow-engine.ts", "stop", "--id", workflow_id])
        return {
            "status": "ok" if res["exit_code"] == 0 else "error",
            "workflow_id": workflow_id,
            "output": res["stdout"],
        }

    def workflow_history(self, workflow_id: str) -> Dict[str, Any]:
        """View run history for a workflow."""
        res = self._run_bun(["run", "scripts/workflow-engine.ts", "history", "--id", workflow_id])
        return {
            "status": "ok" if res["exit_code"] == 0 else "error",
            "workflow_id": workflow_id,
            "output": res["stdout"],
        }

    # -----------------------------------------------------------------------
    # 8. Autonomous Task Delegation
    # -----------------------------------------------------------------------
    def run_autonomous_task(self, prompt: str, model: Optional[str] = None, timeout: float = 300.0) -> Dict[str, Any]:
        """Delegate an autonomous social media mission to LocoAgent's agentic loop."""
        args = ["start", "-p", prompt]
        if model:
            args.extend(["--model", model])
        res = self._run_bun(args, timeout=timeout)
        return {
            "status": "ok" if res["exit_code"] == 0 else "error",
            "task_prompt": prompt,
            "output": res["stdout"] or res["stderr"],
        }

    # -----------------------------------------------------------------------
    # 9. Health & Diagnostics
    # -----------------------------------------------------------------------
    def doctor(self) -> Dict[str, Any]:
        """Run health check across Bun, agent-browser, Chrome, and targets."""
        res = self._run_bun(["run", "scripts/doctor.ts"])
        targets = self.list_targets_status()
        return {
            "status": "ok" if res["exit_code"] == 0 else "error",
            "output": res["stdout"] or res["stderr"],
            "targets": targets,
        }
