"""macOS Harness Adapter for OpenAgent.

Connects the native macOS Harness (screen vision, background PID-targeted input,
Accessibility inspections, and Browser Harness CDP) directly to OpenAgent.

Enables Jarvis to operate macOS apps and Chrome just like a human user without
moving the user's physical mouse cursor or stealing application focus.
"""

from __future__ import annotations

import contextlib
import io
import json
import logging
import os
import re
import subprocess
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

from macos_harness import BrowserHarness, MacOS, MacOSError

try:
    from .browser_adapter import BrowserAdapter
except ImportError:
    BrowserAdapter = None  # type: ignore[assignment,misc]

try:
    from .firecrawl_adapter import FirecrawlAdapter
except ImportError:
    FirecrawlAdapter = None  # type: ignore[assignment,misc]

logger = logging.getLogger("openagent.mac_adapter")

# Prohibited target set for GUI input (empty by default; WhatsApp Desktop is permitted).
PROHIBITED_TARGETS: set[str] = set()


def _check_target_allowed(app: Optional[str]) -> None:
    """Ensure the target app is not in the prohibited targets list."""
    if not app:
        return
    normalized = app.strip().lower()
    if normalized in PROHIBITED_TARGETS:
        raise MacOSError(
            f"Targeting '{app}' is prohibited."
        )


class MacAdapter:
    """High-level adapter wrapping MacOS and BrowserHarness for OpenAgent."""

    def __init__(
        self,
        mac: Optional[MacOS] = None,
        browser: Optional[Any] = None,
        firecrawl: Optional[Any] = None,
    ):
        self.mac = mac if mac is not None else MacOS()
        if browser is not None:
            self.browser = browser
        elif BrowserAdapter is not None:
            self.browser = BrowserAdapter()
        else:
            self.browser = BrowserHarness()

        if firecrawl is not None:
            self.firecrawl = firecrawl
        elif FirecrawlAdapter is not None:
            try:
                self.firecrawl = FirecrawlAdapter()
            except Exception:
                self.firecrawl = None
        else:
            self.firecrawl = None

    # -----------------------------------------------------------------------
    # 1. Compound Python Burst Execution (Beats WhatsApp Round-Trip Latency)
    # -----------------------------------------------------------------------
    def run_python(self, code: str, timeout: float = 30.0) -> Dict[str, Any]:
        """Execute a Python script with mac, browser, firecrawl, Path, and subprocess preloaded.

        Allows Jarvis to run multi-step UI bursts (e.g. focus field, type, click, verify)
        in milliseconds locally, avoiding multiple 2-second WhatsApp roundtrips.
        """
        if not code or not code.strip():
            raise ValueError("No Python code provided for execution")

        stdout_buf = io.StringIO()
        stderr_buf = io.StringIO()
        namespace = {
            "__name__": "__openagent_mac__",
            "mac": self.mac,
            "browser": self.browser,
            "firecrawl": self.firecrawl,
            "Path": Path,
            "subprocess": subprocess,
            "time": time,
            "json": json,
            "re": re,
        }

        t_start = time.monotonic()
        exec_exc = None
        try:
            compiled = compile(code, "<openagent-mac>", "exec")
        except Exception as compile_err:
            return {
                "status": "error",
                "error": f"{type(compile_err).__name__}: {compile_err}",
                "stdout": "",
                "stderr": "",
                "duration_s": 0.0,
            }

        import threading

        def worker():
            nonlocal exec_exc
            try:
                with contextlib.redirect_stdout(stdout_buf), contextlib.redirect_stderr(stderr_buf):
                    exec(compiled, namespace, namespace)  # noqa: S102
            except Exception as exc:
                exec_exc = exc

        th = threading.Thread(target=worker, daemon=True)
        th.start()
        th.join(timeout=timeout)

        if th.is_alive():
            duration = round(time.monotonic() - t_start, 3)
            return {
                "status": "error",
                "error": f"TimeoutExpired: Python script exceeded timeout of {timeout}s",
                "stdout": stdout_buf.getvalue().strip(),
                "stderr": stderr_buf.getvalue().strip(),
                "duration_s": duration,
            }

        if exec_exc:
            duration = round(time.monotonic() - t_start, 3)
            err_output = stderr_buf.getvalue().strip()
            out_output = stdout_buf.getvalue().strip()
            return {
                "status": "error",
                "error": f"{type(exec_exc).__name__}: {exec_exc}",
                "stdout": out_output,
                "stderr": err_output,
                "duration_s": duration,
            }

        duration = round(time.monotonic() - t_start, 3)
        stdout_text = stdout_buf.getvalue().strip()
        stderr_text = stderr_buf.getvalue().strip()

        result: Dict[str, Any] = {
            "status": "ok",
            "stdout": stdout_text,
            "duration_s": duration,
        }
        if stderr_text:
            result["stderr"] = stderr_text

        # If a screenshot was taken during execution, attach its metadata
        if getattr(self.mac, "_last_screenshot", None):
            last_shot = self.mac._last_screenshot
            result["last_screenshot"] = {
                "path": str(last_shot.get("path", "")),
                "app": last_shot.get("app"),
                "width": last_shot.get("width"),
                "height": last_shot.get("height"),
            }

        return result

    # -----------------------------------------------------------------------
    # 2. Vision and Screen Perception (mac.see)
    # -----------------------------------------------------------------------
    def see(
        self,
        app: Optional[str] = None,
        *,
        window_index: int = 0,
        max_width: int = 1280,
        max_height: int = 1280,
        send_image: bool = False,
        include_summary: bool = True,
    ) -> Dict[str, Any]:
        """Capture a bounded application window without bringing it to the foreground.

        Parameters
        ----------
        app : str, optional
            Target application name (e.g. "Safari", "Spotify", "Finder").
        window_index : int
            Window index to capture (default 0).
        max_width, max_height : int
            Maximum dimensions for the captured image.
        send_image : bool
            If True, signals OpenAgent to send the screenshot as a WhatsApp attachment.
        include_summary : bool
            If True, includes a compact summary of visible interactive controls.
        """
        _check_target_allowed(app)

        screenshot = self.mac.see(
            app=app,
            window_index=window_index,
            max_width=max_width,
            max_height=max_height,
        )

        res: Dict[str, Any] = {
            "app": screenshot.get("app", app or "frontmost"),
            "pid": screenshot.get("pid"),
            "window_index": window_index,
            "bounds": screenshot.get("bounds"),
            "width": screenshot.get("width"),
            "height": screenshot.get("height"),
            "scale_x": screenshot.get("scale_x"),
            "scale_y": screenshot.get("scale_y"),
            "focus": screenshot.get("focus"),
            "screenshot_path": str(screenshot.get("path", "")),
        }

        # Compact UI summary so Jarvis can understand interactive buttons in text mode
        if include_summary and app:
            try:
                state = self.mac.get_app_state(app, screenshot=False, max_depth=8, max_nodes=60)
                nodes = state.get("nodes", [])
                interactive = []
                for n in nodes:
                    role = n.get("role", "")
                    title = n.get("title") or n.get("description") or n.get("value")
                    frame = n.get("frame")
                    if role in ("AXButton", "AXTextField", "AXTextArea", "AXLink", "AXCheckBox", "AXPopUpButton", "AXMenuItem"):
                        ctrl_desc = f"{role}: '{title}'" if title else role
                        if frame:
                            ctrl_desc += f" at ({round(frame.get('x', 0))},{round(frame.get('y', 0))})"
                        interactive.append(ctrl_desc)
                if interactive:
                    res["interactive_controls"] = interactive[:20]
            except Exception as exc:
                logger.debug("Failed to extract interactive control summary: %s", exc)

        if send_image and screenshot.get("path"):
            res["_send_attachment"] = str(screenshot["path"])

        return res

    # -----------------------------------------------------------------------
    # 3. Direct Input Primitives (Click, Move, Type, Key, Drag, Scroll)
    # -----------------------------------------------------------------------
    def click(
        self,
        x: float,
        y: float,
        app: Optional[str] = None,
        button: str = "left",
        click_count: int = 1,
    ) -> Dict[str, Any]:
        """Send a click directly to an application's PID without moving the physical cursor."""
        _check_target_allowed(app)
        self.mac.click(float(x), float(y), app=app, button=button, click_count=int(click_count))
        return {
            "status": "ok",
            "action": "click",
            "x": float(x),
            "y": float(y),
            "app": app,
            "button": button,
            "click_count": click_count,
        }

    def move(self, x: float, y: float, app: Optional[str] = None) -> Dict[str, Any]:
        """Move the virtual pointer overlay without moving the physical cursor."""
        _check_target_allowed(app)
        self.mac.move(float(x), float(y), app=app)
        return {"status": "ok", "action": "move", "x": float(x), "y": float(y), "app": app}

    def type(self, text: str, app: Optional[str] = None) -> Dict[str, Any]:
        """Send keystrokes directly to the target application's PID."""
        _check_target_allowed(app)
        self.mac.type(str(text), app=app)
        return {"status": "ok", "action": "type", "length": len(text), "app": app}

    def key(self, key: str, app: Optional[str] = None) -> Dict[str, Any]:
        """Send a keyboard shortcut (e.g. 'cmd+k', 'cmd+space', 'enter') to the app PID."""
        _check_target_allowed(app)
        self.mac.key(str(key), app=app)
        return {"status": "ok", "action": "key", "key": key, "app": app}

    def drag(
        self,
        start_x: float,
        start_y: float,
        end_x: float,
        end_y: float,
        app: Optional[str] = None,
        duration: float = 0.35,
        button: str = "left",
    ) -> Dict[str, Any]:
        """Perform a drag operation from start to end coordinates."""
        _check_target_allowed(app)
        self.mac.drag(
            float(start_x),
            float(start_y),
            float(end_x),
            float(end_y),
            app=app,
            duration=float(duration),
            button=button,
        )
        return {
            "status": "ok",
            "action": "drag",
            "from": (start_x, start_y),
            "to": (end_x, end_y),
            "app": app,
        }

    def scroll(
        self,
        x: float,
        y: float,
        dx: int = 0,
        dy: int = 0,
        app: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Send a scroll wheel event at coordinates (x, y)."""
        _check_target_allowed(app)
        self.mac.scroll(float(x), float(y), dx=int(dx), dy=int(dy), app=app)
        return {"status": "ok", "action": "scroll", "x": x, "y": y, "dx": dx, "dy": dy, "app": app}

    # -----------------------------------------------------------------------
    # 4. Applications and Windows Inspection
    # -----------------------------------------------------------------------
    def list_apps(self) -> List[Dict[str, Any]]:
        """List running macOS applications with their bundle IDs and PIDs."""
        raw_apps = self.mac.list_apps()
        # Filter down to non-system / interactive applications
        filtered = []
        for a in raw_apps:
            name = a.get("name")
            if not name or name.startswith("."):
                continue
            filtered.append({
                "name": name,
                "bundle_id": a.get("bundle_id"),
                "pid": a.get("pid"),
            })
        return filtered

    def windows(self, app: Optional[str] = None) -> List[Dict[str, Any]]:
        """List open windows and their coordinates for an application or all apps."""
        _check_target_allowed(app)
        return self.mac.windows(app=app)

    # -----------------------------------------------------------------------
    # 5. Apple Accessibility Operations (mac.ax)
    # -----------------------------------------------------------------------
    def ax(
        self,
        action: str,
        *,
        app: Optional[str] = None,
        x: Optional[float] = None,
        y: Optional[float] = None,
        text: Optional[str] = None,
        element_index: Optional[int] = None,
        element_action: str = "AXPress",
        attribute: str = "AXValue",
        value: Optional[Any] = None,
        limit: int = 20,
    ) -> Any:
        """Perform targeted Apple Accessibility operations."""
        _check_target_allowed(app)
        action = action.strip().lower()

        if action == "at":
            if x is None or y is None:
                raise ValueError("'x' and 'y' coordinates are required for ax 'at' action")
            return self.mac.ax.at(float(x), float(y), app=app)

        elif action == "query":
            return self.mac.ax.query(app=app, text=text, limit=limit)

        elif action == "perform":
            if element_index is None:
                raise ValueError("'element_index' is required for ax 'perform' action")
            self.mac.perform_action(int(element_index), action=element_action)
            return {"status": "ok", "performed": element_action, "element_index": element_index}

        elif action == "get":
            if element_index is None:
                raise ValueError("'element_index' is required for ax 'get' action")
            val = self.mac.ax.get(int(element_index), attributes=attribute)
            return {"status": "ok", "element_index": element_index, "attribute": attribute, "value": val}

        elif action == "set":
            if element_index is None or value is None:
                raise ValueError("'element_index' and 'value' are required for ax 'set' action")
            self.mac.ax.set(int(element_index), attribute=attribute, value=value)
            return {"status": "ok", "element_index": element_index, "attribute": attribute}

        elif action == "state":
            if not app:
                raise ValueError("'app' is required for ax 'state' action")
            return self.mac.get_app_state(app, screenshot=False, max_depth=10, max_nodes=200)

        else:
            raise ValueError(f"Unknown ax action: '{action}'. Choose from: at, query, perform, get, set, state")

    # -----------------------------------------------------------------------
    # 6. Browser Harness CDP Operations
    # -----------------------------------------------------------------------
    def browser_op(self, action: str, **kwargs: Any) -> Any:
        """Execute a browser automation operation via Browser Harness (Chrome CDP)."""
        action = action.strip().lower()

        if hasattr(self.browser, "browser_op"):
            return self.browser.browser_op(action, **kwargs)

        if action == "page_info":
            return self.browser.page_info()
        elif action == "tabs":
            if hasattr(self.browser, "list_tabs"):
                return self.browser.list_tabs()
            return getattr(self.browser, "tabs", lambda: [])()
        elif action in ("navigate", "goto", "open"):
            url = kwargs.get("url")
            if not url:
                raise ValueError("'url' is required for browser navigate")
            if hasattr(self.browser, "goto_url"):
                return self.browser.goto_url(url)
            return self.browser.navigate(url)
        elif action in ("eval", "js"):
            expr = kwargs.get("expression") or kwargs.get("script")
            if not expr:
                raise ValueError("'expression' is required for browser eval")
            if hasattr(self.browser, "js"):
                return self.browser.js(expr)
            return self.browser.eval(expr)
        else:
            # Fallback to direct attribute call on browser
            fn = getattr(self.browser, action, None)
            if callable(fn):
                return fn(**kwargs)
            raise ValueError(f"Unknown browser action: '{action}'")

    # -----------------------------------------------------------------------
    # 7. System Diagnostics & Doctor
    # -----------------------------------------------------------------------
    def doctor(self) -> Dict[str, Any]:
        """Check macOS permissions and runtime availability."""
        return self.mac.doctor()
