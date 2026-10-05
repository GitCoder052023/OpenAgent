"""Browser Harness Adapter for OpenAgent.

Integrates the production-grade Browser Harness CDP engine directly into
OpenAgent, enabling external intelligence (Instinct / Jarvis) to control
the user's real, authenticated Chrome browser session in the background
without stealing window focus or moving the physical mouse cursor.

Key Capabilities:
- Full tab management (new_tab, switch_tab, close_tab, list_tabs, current_tab)
- Framework-safe input filling (React/Vue synthetic events, SelectAll+Backspace)
- Composited CDP click dispatching (bypasses iframes, shadow DOM)
- Perception via Accessibility Tree (getFullAXTree + DOM.getBoxModel)
- Screenshot capture with WhatsApp image attachment delivery (_send_attachment)
- High-speed compound Python burst execution (chains actions in <200ms locally)
- Safety guards against touching WhatsApp Web or prohibited domains
- Domain skills integration from agent-workspace
"""

from __future__ import annotations

import contextlib
import io
import json
import logging
import os
import re
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Union
from urllib.parse import urlparse

try:
    from .firecrawl_adapter import FirecrawlAdapter
except ImportError:
    FirecrawlAdapter = None  # type: ignore[assignment,misc]

logger = logging.getLogger("openagent.browser_adapter")

PROHIBITED_BROWSER_DOMAINS = {
    "web.whatsapp.com",
    "whatsapp.com",
    "api.whatsapp.com",
}


class BrowserError(Exception):
    """Raised when a browser automation operation fails."""
    pass


def _check_url_allowed(url: Optional[str]) -> None:
    """Ensure the target URL does not target WhatsApp Web."""
    if not url:
        return
    parsed = urlparse(url if "://" in url else f"http://{url}")
    host = (parsed.hostname or "").lower()
    for prohibited in PROHIBITED_BROWSER_DOMAINS:
        if host == prohibited or host.endswith("." + prohibited):
            raise BrowserError(
                f"Targeting '{url}' is prohibited. WhatsApp Web is reserved to protect bridge communication."
            )


class BrowserAdapter:
    """High-level adapter wrapping browser-harness for OpenAgent."""

    def __init__(
        self,
        helpers: Optional[Any] = None,
        wait: float = 30.0,
        name: Optional[str] = None,
    ):
        self._helpers = helpers
        self.wait = wait
        self.name = name
        self._ensure_workspace_env()

    def _ensure_workspace_env(self) -> None:
        """Configure default workspace & domain skill paths if unset."""
        if "BH_AGENT_WORKSPACE" not in os.environ:
            root = Path(__file__).resolve().parent.parent
            workspace = root / "browser-harness" / "agent-workspace"
            if workspace.exists():
                os.environ["BH_AGENT_WORKSPACE"] = str(workspace)

        if "BH_DOMAIN_SKILLS" not in os.environ:
            os.environ["BH_DOMAIN_SKILLS"] = "1"

    def connect(self) -> Any:
        """Connect to the browser-harness daemon and return the helpers module."""
        if self._helpers is not None:
            return self._helpers

        if self.name:
            os.environ["BU_NAME"] = self.name

        try:
            from browser_harness import admin, helpers
        except ImportError as exc:
            raise RuntimeError(
                "Browser Harness is unavailable. Install with `uv sync` (or `uv pip install -e ./src/tools/browser-harness`)."
            ) from exc

        # On macOS, launch the watcher for Chrome's remote debugging prompt
        approver = None
        if sys.platform == "darwin":
            try:
                approver = subprocess.Popen(
                    [
                        sys.executable,
                        "-c",
                        (
                            "from browser_harness.macos import approve_remote_debugging; "
                            "import time; "
                            "deadline = time.monotonic() + 15; "
                            "while time.monotonic() < deadline: "
                            "  st, _ = approve_remote_debugging(); "
                            "  if st == 'ready': break; "
                            "  time.sleep(0.1)"
                        ),
                    ],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
            except Exception:
                pass

        try:
            admin.ensure_daemon(wait=self.wait, name=self.name)
        finally:
            if approver and approver.poll() is None:
                approver.terminate()
                try:
                    approver.wait(timeout=0.2)
                except subprocess.TimeoutExpired:
                    approver.kill()

        if self.name:
            helpers.NAME = self.name
        self._helpers = helpers
        return self._helpers

    @property
    def helpers(self) -> Any:
        return self.connect()

    # -----------------------------------------------------------------------
    # 1. Navigation & Page Information
    # -----------------------------------------------------------------------
    def open(self, url: str, new_tab: bool = False) -> Dict[str, Any]:
        """Navigate to a URL or open a new background tab."""
        _check_url_allowed(url)
        if new_tab:
            nav_res = self.helpers.new_tab(url)
        else:
            nav_res = self.helpers.goto_url(url)

        try:
            info = self.page_info()
        except Exception:
            info = {"url": url}

        return {
            "status": "ok",
            "action": "open",
            "url": info.get("url", url),
            "title": info.get("title", ""),
            "navigation": nav_res,
        }

    def page_info(self) -> Dict[str, Any]:
        """Retrieve current tab viewport, scroll coordinates, and title."""
        info = self.helpers.page_info()
        return info if isinstance(info, dict) else {"info": info}

    # -----------------------------------------------------------------------
    # 2. Input & Interaction
    # -----------------------------------------------------------------------
    def _get_selector_center(self, selector: str) -> Dict[str, float]:
        """Resolve center (x, y) coordinates for a CSS selector."""
        expr = (
            f"(() => {{"
            f"  const el = document.querySelector({json.dumps(selector)});"
            f"  if (!el) return null;"
            f"  const r = el.getBoundingClientRect();"
            f"  if (r.width === 0 && r.height === 0) return null;"
            f"  return {{ x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }};"
            f"}})()"
        )
        coords = self.helpers.js(expr)
        if not coords or not isinstance(coords, dict) or "x" not in coords or "y" not in coords:
            raise ValueError(f"Could not find visible element matching selector: '{selector}'")
        return {"x": float(coords["x"]), "y": float(coords["y"])}

    def click(
        self,
        x: Optional[float] = None,
        y: Optional[float] = None,
        selector: Optional[str] = None,
        button: str = "left",
        clicks: int = 1,
    ) -> Dict[str, Any]:
        """Click at (x, y) coordinates or automatically resolve selector center."""
        target_x: float
        target_y: float

        if x is not None and y is not None:
            target_x = float(x)
            target_y = float(y)
        elif selector:
            coords = self._get_selector_center(selector)
            target_x = coords["x"]
            target_y = coords["y"]
        else:
            raise ValueError("Either ('x', 'y') coordinates or 'selector' must be specified for browser click")

        self.helpers.click_at_xy(target_x, target_y, button=button, clicks=int(clicks))
        return {
            "status": "ok",
            "action": "click",
            "x": target_x,
            "y": target_y,
            "selector": selector,
            "button": button,
            "click_count": int(clicks),
        }

    def fill(
        self,
        selector: str,
        text: str,
        clear_first: bool = True,
        timeout: float = 5.0,
    ) -> Dict[str, Any]:
        """Fill an input field with framework awareness (React/Vue synthetic events)."""
        if not selector:
            raise ValueError("'selector' is required for fill")
        self.helpers.fill_input(selector, str(text), clear_first=bool(clear_first), timeout=float(timeout))
        return {
            "status": "ok",
            "action": "fill",
            "selector": selector,
            "length": len(str(text)),
        }

    def type(self, text: str) -> Dict[str, Any]:
        """Type text into currently focused element via CDP Input.insertText."""
        self.helpers.type_text(str(text))
        return {"status": "ok", "action": "type", "length": len(str(text))}

    def key(self, key: str, modifiers: int = 0) -> Dict[str, Any]:
        """Press a keyboard key (e.g. 'Enter', 'Escape', 'Tab', 'Backspace', 'KeyA')."""
        if not key:
            raise ValueError("'key' is required for key action")
        self.helpers.press_key(str(key), modifiers=int(modifiers))
        return {"status": "ok", "action": "key", "key": str(key)}

    def scroll(
        self,
        x: float = 0,
        y: float = 0,
        dx: int = 0,
        dy: int = -300,
        selector: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Scroll the page or scroll a specific element into view."""
        if selector:
            expr = (
                f"(() => {{"
                f"  const el = document.querySelector({json.dumps(selector)});"
                f"  if (!el) return false;"
                f"  el.scrollIntoView({{behavior: 'smooth', block: 'center', inline: 'center'}});"
                f"  return true;"
                f"}})()"
            )
            found = self.helpers.js(expr)
            if not found:
                raise ValueError(f"Element matching selector '{selector}' not found to scroll")
            return {"status": "ok", "action": "scroll", "selector": selector}

        self.helpers.scroll(float(x), float(y), dy=int(dy), dx=int(dx))
        return {"status": "ok", "action": "scroll", "x": x, "y": y, "dx": dx, "dy": dy}

    # -----------------------------------------------------------------------
    # 3. Tab Management
    # -----------------------------------------------------------------------
    def tabs(
        self,
        action: str = "list",
        target: Optional[Any] = None,
        url: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Inspect and manage browser tabs."""
        action = action.strip().lower()

        if action in ("list", "all"):
            tabs_list = self.helpers.list_tabs()
            return {"status": "ok", "action": "list", "tabs": tabs_list, "total": len(tabs_list)}

        elif action == "new":
            if url:
                _check_url_allowed(url)
            new_tab = self.helpers.new_tab(url or "about:blank")
            return {"status": "ok", "action": "new", "tab": new_tab}

        elif action == "switch":
            if not target:
                raise ValueError("'target' tab ID, index, or URL substring is required to switch")
            switched = self.helpers.switch_tab(target)
            return {"status": "ok", "action": "switch", "target": target, "tab": switched}

        elif action == "close":
            closed = self.helpers.close_tab(target)
            return {"status": "ok", "action": "close", "target": target, "tab": closed}

        elif action == "current":
            cur = self.helpers.current_tab()
            return {"status": "ok", "action": "current", "tab": cur}

        else:
            raise ValueError(
                f"Unknown tabs action: '{action}'. Choose from: list, new, switch, close, current"
            )

    # -----------------------------------------------------------------------
    # 4. Perception & Screenshots
    # -----------------------------------------------------------------------
    def screenshot(
        self,
        path: Optional[str] = None,
        full: bool = False,
        max_dim: Optional[int] = None,
        send_image: bool = False,
    ) -> Dict[str, Any]:
        """Capture tab screenshot. Optionally queues file attachment for WhatsApp."""
        if path is None:
            fd, temp_path = tempfile.mkstemp(suffix=".png", prefix="OpenAgent-browser-")
            os.close(fd)
            path = temp_path

        saved = self.helpers.capture_screenshot(path=path, full=full, max_dim=max_dim)
        res = {
            "status": "ok",
            "path": str(saved),
            "screenshot_path": str(saved),
        }
        if send_image:
            res["_send_attachment"] = str(saved)
        return res

    def see(self, send_image: bool = False, max_elements: int = 25) -> Dict[str, Any]:
        """Perceive current page state: dimensions, screenshot, and AX controls."""
        info = self.page_info()
        shot_res = self.screenshot(send_image=send_image)

        ax_res = self.ax(action="query", limit=max_elements)
        elements = ax_res.get("elements", [])
        controls_summary = [
            f"{e.get('role', 'element')}: '{e.get('name') or e.get('value')}' at ({e.get('x')}, {e.get('y')})"
            for e in elements
            if "x" in e and "y" in e
        ]

        res = {
            "status": "ok",
            "url": info.get("url", ""),
            "title": info.get("title", ""),
            "width": info.get("w", 0),
            "height": info.get("h", 0),
            "screenshot_path": shot_res.get("path"),
            "interactive_controls": controls_summary[:max_elements],
        }
        if send_image:
            res["_send_attachment"] = shot_res.get("path")
        return res

    # -----------------------------------------------------------------------
    # 5. Accessibility Tree Querying
    # -----------------------------------------------------------------------
    def ax(
        self,
        action: str = "query",
        text: Optional[str] = None,
        role: Optional[str] = None,
        limit: int = 25,
    ) -> Dict[str, Any]:
        """Semantic query over Chrome Accessibility tree with resolved coordinates."""
        try:
            tree = self.helpers.cdp("Accessibility.getFullAXTree")
            nodes = tree.get("nodes", [])
        except Exception as exc:
            return {"status": "error", "error": f"Failed to get AX tree: {exc}", "elements": []}

        interactive_roles = {
            "button", "link", "combobox", "searchbox", "textbox", "checkbox",
            "radio", "menuitem", "tab", "switch", "slider", "heading"
        }

        elements = []
        for node in nodes:
            r = node.get("role", {}).get("value", "") if isinstance(node.get("role"), dict) else str(node.get("role", ""))
            n = node.get("name", {}).get("value", "") if isinstance(node.get("name"), dict) else str(node.get("name", ""))
            v = node.get("value", {}).get("value", "") if isinstance(node.get("value"), dict) else str(node.get("value", ""))
            backend_id = node.get("backendDOMNodeId")

            if not backend_id:
                continue
            if role and r.lower() != role.lower():
                continue
            if not role and r.lower() not in interactive_roles:
                continue
            if text and text.lower() not in n.lower() and text.lower() not in v.lower():
                continue
            if not n and not v and r.lower() not in ("searchbox", "textbox"):
                continue

            item: Dict[str, Any] = {
                "backend_id": backend_id,
                "role": r,
                "name": n,
                "value": v,
            }

            # Attempt to resolve viewport bounding coordinates via BoxModel
            try:
                box = self.helpers.cdp("DOM.getBoxModel", backendNodeId=backend_id)
                content = box.get("model", {}).get("content")
                if content and len(content) >= 8:
                    item["x"] = round(sum(content[0::2]) / 4, 1)
                    item["y"] = round(sum(content[1::2]) / 4, 1)
            except Exception:
                pass

            elements.append(item)
            if len(elements) >= limit:
                break

        return {
            "status": "ok",
            "total": len(elements),
            "elements": elements,
        }

    # -----------------------------------------------------------------------
    # 6. JavaScript & CDP Execution
    # -----------------------------------------------------------------------
    def js(self, expression: str, target_id: Optional[str] = None) -> Any:
        """Evaluate a JavaScript expression in the current tab."""
        if not expression:
            raise ValueError("'expression' is required for js evaluation")
        return self.helpers.js(expression, target_id=target_id)

    def cdp(self, method: str, session_id: Optional[str] = None, **params: Any) -> Any:
        """Send raw Chrome DevTools Protocol (CDP) method."""
        if not method:
            raise ValueError("'method' is required for cdp")
        return self.helpers.cdp(method, session_id=session_id, **params)

    # -----------------------------------------------------------------------
    # 7. Waiting
    # -----------------------------------------------------------------------
    def wait(
        self,
        for_what: str = "load",
        selector: Optional[str] = None,
        timeout: float = 15.0,
    ) -> Dict[str, Any]:
        """Wait for page load, element presence, or network idle."""
        for_what = for_what.strip().lower()

        if for_what == "load":
            self.helpers.wait_for_load(timeout=float(timeout))
            return {"status": "ok", "waited_for": "load"}
        elif for_what == "element":
            if not selector:
                raise ValueError("'selector' is required when waiting for element")
            self.helpers.wait_for_element(selector, timeout=float(timeout))
            return {"status": "ok", "waited_for": "element", "selector": selector}
        elif for_what in ("network", "idle"):
            self.helpers.wait_for_network_idle(timeout=float(timeout))
            return {"status": "ok", "waited_for": "network"}
        else:
            raise ValueError(f"Unknown wait target: '{for_what}'. Choose from: load, element, network")

    # -----------------------------------------------------------------------
    # 8. High-Speed Compound Python Burst Execution
    # -----------------------------------------------------------------------
    def run_python(self, code: str, timeout: float = 30.0) -> Dict[str, Any]:
        """Execute multi-step compound browser Python workflows locally in milliseconds."""
        if not code or not code.strip():
            raise ValueError("No Python code provided for browser script execution")

        h = self.helpers

        stdout_buf = io.StringIO()
        stderr_buf = io.StringIO()
        namespace = {
            "__name__": "__openagent_browser__",
            "browser": self,
            "helpers": h,
            "cdp": h.cdp,
            "js": h.js,
            "goto_url": h.goto_url,
            "new_tab": h.new_tab,
            "switch_tab": h.switch_tab,
            "close_tab": h.close_tab,
            "list_tabs": h.list_tabs,
            "current_tab": h.current_tab,
            "page_info": h.page_info,
            "click_at_xy": h.click_at_xy,
            "fill_input": h.fill_input,
            "type_text": h.type_text,
            "press_key": h.press_key,
            "scroll": h.scroll,
            "capture_screenshot": h.capture_screenshot,
            "wait_for_load": h.wait_for_load,
            "wait_for_element": h.wait_for_element,
            "wait_for_network_idle": getattr(h, "wait_for_network_idle", None),
            "json": json,
            "time": time,
            "re": re,
            "Path": Path,
            "subprocess": subprocess,
            "firecrawl": FirecrawlAdapter() if FirecrawlAdapter is not None else None,
        }

        t_start = time.monotonic()
        exec_exc = None
        try:
            compiled = compile(code, "<openagent-browser>", "exec")
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

        duration = round(time.monotonic() - t_start, 3)

        if th.is_alive():
            return {
                "status": "error",
                "error": f"Browser script execution timed out after {timeout}s",
                "stdout": stdout_buf.getvalue(),
                "stderr": stderr_buf.getvalue(),
                "duration_s": duration,
            }

        stdout_val = stdout_buf.getvalue()
        stderr_val = stderr_buf.getvalue()

        if exec_exc is not None:
            return {
                "status": "error",
                "error": f"{type(exec_exc).__name__}: {exec_exc}",
                "stdout": stdout_val,
                "stderr": stderr_val,
                "duration_s": duration,
            }

        return {
            "status": "ok",
            "stdout": stdout_val,
            "stderr": stderr_val,
            "duration_s": duration,
        }

    # -----------------------------------------------------------------------
    # 9. Domain Skills Inspection
    # -----------------------------------------------------------------------
    def domain_skills(self, host: Optional[str] = None) -> List[Dict[str, Any]]:
        """List available pre-built domain skills for a host or current page."""
        if not host:
            try:
                url = self.page_info().get("url", "")
                host = urlparse(url).hostname or ""
            except Exception:
                host = ""

        clean_host = (host or "").removeprefix("www.").split(".")[0].lower()
        if not clean_host:
            return []

        workspace = Path(os.environ.get("BH_AGENT_WORKSPACE", ""))
        skills_dir = workspace / "domain-skills" / clean_host
        if not skills_dir.is_dir():
            return []

        results = []
        for p in sorted(skills_dir.rglob("*.md")):
            results.append({
                "skill": p.stem,
                "file": p.name,
                "path": str(p),
            })
        return results

    # -----------------------------------------------------------------------
    # 10. Universal Operational Dispatcher (Unified Compatibility)
    # -----------------------------------------------------------------------
    def browser_op(self, action: str, **kwargs: Any) -> Any:
        """Route generic or legacy browser action requests."""
        action = action.strip().lower()

        if action in ("page_info", "info"):
            return self.page_info()
        elif action in ("navigate", "goto", "open"):
            url = kwargs.get("url")
            if not url:
                raise ValueError("'url' is required for browser open/goto")
            return self.open(url, new_tab=bool(kwargs.get("new_tab", False)))
        elif action in ("eval", "js"):
            expr = kwargs.get("expression") or kwargs.get("script") or kwargs.get("code")
            if not expr:
                raise ValueError("'expression' is required for browser eval")
            return self.js(expr)
        elif action == "tabs":
            subaction = kwargs.get("subaction", kwargs.get("action", "list"))
            return self.tabs(action=subaction, target=kwargs.get("target"), url=kwargs.get("url"))
        elif action == "click":
            return self.click(
                x=kwargs.get("x"),
                y=kwargs.get("y"),
                selector=kwargs.get("selector"),
                button=kwargs.get("button", "left"),
                clicks=int(kwargs.get("click_count", kwargs.get("clicks", 1))),
            )
        elif action == "fill":
            return self.fill(
                selector=kwargs.get("selector", ""),
                text=kwargs.get("text", kwargs.get("value", "")),
                clear_first=bool(kwargs.get("clear_first", True)),
                timeout=float(kwargs.get("timeout", 5.0)),
            )
        elif action == "type":
            return self.type(kwargs.get("text", ""))
        elif action == "key":
            return self.key(kwargs.get("key", ""), modifiers=int(kwargs.get("modifiers", 0)))
        elif action == "scroll":
            return self.scroll(
                x=float(kwargs.get("x", 0)),
                y=float(kwargs.get("y", 0)),
                dx=int(kwargs.get("dx", 0)),
                dy=int(kwargs.get("dy", -300)),
                selector=kwargs.get("selector"),
            )
        elif action in ("see", "inspect"):
            return self.see(
                send_image=bool(kwargs.get("send_image", False)),
                max_elements=int(kwargs.get("max_elements", 25)),
            )
        elif action in ("screenshot", "capture"):
            return self.screenshot(
                path=kwargs.get("path"),
                full=bool(kwargs.get("full", False)),
                max_dim=kwargs.get("max_dim"),
                send_image=bool(kwargs.get("send_image", False)),
            )
        elif action == "ax":
            return self.ax(
                action=kwargs.get("action", "query"),
                text=kwargs.get("text"),
                role=kwargs.get("role"),
                limit=int(kwargs.get("limit", 25)),
            )
        elif action == "wait":
            return self.wait(
                for_what=kwargs.get("for_what", "load"),
                selector=kwargs.get("selector"),
                timeout=float(kwargs.get("timeout", 15.0)),
            )
        elif action in ("run", "run_python", "script", "python"):
            code = kwargs.get("code") or kwargs.get("script")
            if not code:
                raise ValueError("'code' is required for browser script run")
            return self.run_python(code=code, timeout=float(kwargs.get("timeout", 30.0)))
        elif action in ("skills", "domain_skills"):
            return self.domain_skills(kwargs.get("host"))
        else:
            # Fallback to direct attribute on helpers
            fn = getattr(self.helpers, action, None)
            if callable(fn):
                return fn(**kwargs)
            raise ValueError(f"Unknown browser action: '{action}'")
