import json
import logging
import re
import sys

_INVISIBLE_CHARS_RE = re.compile(r"[\u200e\u200f\u202a-\u202e\ufeff]")


def _strip_invisible(text):
    return _INVISIBLE_CHARS_RE.sub("", text) if text else ""



def _is_whatsapp_process(app):
    bid = (app.bundleIdentifier() or "").lower()
    name = (app.localizedName() or "").strip("\u200e").lower()
    if bid == "net.whatsapp.whatsapp":
        return True
    if "whatsapp" in name and not any(x in name or x in bid for x in ("autofill", "serviceextension", "shareextension", "helper")):
        return True
    return False


def get_whatsapp_pid():
    if sys.platform != "darwin": return None
    try:
        from AppKit import NSRunningApplication
        apps = NSRunningApplication.runningApplicationsWithBundleIdentifier_("net.whatsapp.WhatsApp")
        if apps:
            return apps[0].processIdentifier()
    except Exception:
        pass
    try:
        from AppKit import NSWorkspace
        running = [a for a in NSWorkspace.sharedWorkspace().runningApplications()
                   if _is_whatsapp_process(a)]
        if running:
            return running[0].processIdentifier()
    except Exception:
        pass
    import Quartz
    apps = [a for a in Quartz.CGWindowListCopyWindowInfo(Quartz.kCGWindowListOptionAll, Quartz.kCGNullWindowID)
            if str(a.get("kCGWindowOwnerName", "")).strip("\u200e").lower() == "whatsapp" and a.get("kCGWindowOwnerPID")]
    return apps[0]["kCGWindowOwnerPID"] if apps else None


def activate_whatsapp():
    if sys.platform != "darwin": return False
    activated = False
    try:
        from AppKit import NSRunningApplication, NSApplicationActivateIgnoringOtherApps
        apps = NSRunningApplication.runningApplicationsWithBundleIdentifier_("net.whatsapp.WhatsApp")
        for a in apps:
            if a.isHidden():
                a.unhide()
            a.activateWithOptions_(NSApplicationActivateIgnoringOtherApps)
            activated = True
    except Exception:
        pass
    if not activated:
        try:
            from AppKit import NSWorkspace, NSApplicationActivateIgnoringOtherApps
            running = [a for a in NSWorkspace.sharedWorkspace().runningApplications()
                       if _is_whatsapp_process(a)]
            for app in running:
                if app.isHidden():
                    app.unhide()
                app.activateWithOptions_(NSApplicationActivateIgnoringOtherApps)
                activated = True
        except Exception:
            pass
    if not activated:
        try:
            import subprocess
            subprocess.run(
                ["osascript", "-e", 'tell application "System Events" to set visible of process "WhatsApp" to true\ntell application "WhatsApp" to activate'],
                check=False, capture_output=True, timeout=1.0
            )
        except Exception:
            pass
    return True



def hide_whatsapp():
    """Hide WhatsApp application instantly to keep user screen completely clean and private."""
    if sys.platform != "darwin": return False
    hidden = False
    try:
        from AppKit import NSRunningApplication
        apps = NSRunningApplication.runningApplicationsWithBundleIdentifier_("net.whatsapp.WhatsApp")
        for a in apps:
            if not a.isHidden():
                a.hide()
            hidden = True
    except Exception:
        pass
    if not hidden:
        try:
            from AppKit import NSWorkspace
            running = [a for a in NSWorkspace.sharedWorkspace().runningApplications()
                       if _is_whatsapp_process(a)]
            for app in running:
                if not app.isHidden():
                    app.hide()
                hidden = True
        except Exception:
            pass
    if not hidden:
        try:
            import subprocess
            subprocess.run(
                ["osascript", "-e", 'tell application "System Events" to set visible of (every process whose name contains "WhatsApp" or bundle identifier is "net.whatsapp.WhatsApp") to false'],
                check=False, capture_output=True, timeout=1.0
            )
        except Exception:
            pass
    return hidden


def launch_whatsapp(hide=True, timeout=10.0):
    """Launch WhatsApp Desktop in background and hide it immediately from front screen."""
    if sys.platform != "darwin":
        return None
    import subprocess
    import time
    pid = get_whatsapp_pid()
    if pid:
        if hide:
            hide_whatsapp()
        return pid

    print("[Bridge] WhatsApp Desktop not running. Launching in background and hiding...")
    try:
        res = subprocess.run(["open", "-g", "-j", "-b", "net.whatsapp.WhatsApp"], capture_output=True)
        if res.returncode != 0:
            res = subprocess.run(["open", "-g", "-j", "-a", "WhatsApp"], capture_output=True)
            if res.returncode != 0:
                import glob
                apps = glob.glob("/Applications/*WhatsApp*.app")
                if apps:
                    subprocess.run(["open", "-g", "-j", apps[0]], capture_output=True)
    except Exception as exc:
        print(f"Warning: Failed to launch WhatsApp: {exc}")
        return None

    t0 = time.monotonic()
    while time.monotonic() - t0 < timeout:
        pid = get_whatsapp_pid()
        if pid:
            if hide:
                hide_whatsapp()
            try:
                from ApplicationServices import AXUIElementCreateApplication, AXUIElementCopyAttributeValue
                root = AXUIElementCreateApplication(pid)
                err, windows = AXUIElementCopyAttributeValue(root, "AXWindows", None)
                if windows and len(windows) > 0:
                    if hide:
                        hide_whatsapp()
                    return pid
            except Exception:
                pass
        time.sleep(0.2)
        if hide and pid:
            hide_whatsapp()

    if hide:
        hide_whatsapp()
    return get_whatsapp_pid()


def snapshot(safe_mode=True, auto_open=True):
    if sys.platform != "darwin":
        raise RuntimeError("macOS required")
    from ApplicationServices import AXUIElementCreateApplication, AXUIElementCopyAttributeValue
    try:
        from ApplicationServices import AXUIElementCopyMultipleAttributeValues
        _can_multi = True
    except Exception:
        _can_multi = False
    pid = get_whatsapp_pid()
    if not pid and auto_open:
        pid = launch_whatsapp(hide=True)
    if not pid:
        if safe_mode:
            raise RuntimeError("WhatsApp Desktop must be open")
        print("Warning: WhatsApp Desktop must be open")
        return []
    root = AXUIElementCreateApplication(pid)
    rows = []
    _attrs = ("AXRole", "AXTitle", "AXValue", "AXDescription", "AXChildren")
    def value(el, attr):
        err, val = AXUIElementCopyAttributeValue(el, attr, None)
        return val if err == 0 else None
    def walk(el, path="", depth=0):
        if depth > 24 or len(rows) > 2500: return
        if _can_multi:
            try:
                err, vals = AXUIElementCopyMultipleAttributeValues(el, _attrs, 0, None)
                if err == 0 and vals and len(vals) == 5:
                    role, title, val, desc, children = vals
                    row = {
                        "path": path,
                        "depth": depth,
                        "role": str(role) if isinstance(role, str) else "",
                        "title": str(title) if isinstance(title, str) else "",
                        "value": str(val) if isinstance(val, str) else "",
                        "description": str(desc) if isinstance(desc, str) else "",
                    }
                    rows.append(row)
                    if children and hasattr(children, "__iter__"):
                        for i, child in enumerate(list(children)[:300]):
                            walk(child, f"{path}/{i}", depth + 1)
                    return
            except Exception:
                pass
        row = {"path": path, "depth": depth}
        for attr in ("Role", "Title", "Value", "Description"):
            raw = value(el, "AX" + attr)
            row[attr.lower()] = str(raw or "") if isinstance(raw, str) else ""
        rows.append(row)
        for i, child in enumerate(list(value(el, "AXChildren") or [])[:300]):
            walk(child, f"{path}/{i}", depth + 1)
    walk(root)
    return rows


def norm_number(value): return "".join(c for c in value if c.isdigit())


_warned_relaxed_chats = set()


def verify_header(rows, number, path, safe_mode=True):
    """Verify chat header.
    
    Verifies that the currently open chat in WhatsApp is the verified Instinct bridge chat.
    Matches against the configured target number and Instinct identity.
    NEVER returns True for unverified or unrelated chats regardless of safe mode.
    """
    target = norm_number(number)

    def _matches_target(r):
        text = " ".join(_strip_invisible(r.get(k, "")) for k in ("title", "value", "description")).casefold()
        digits = norm_number(text)
        if target and len(target) >= 7 and target in digits:
            return True
        if number and number.casefold() in text:
            return True
        if "instinct" in text:
            return True
        p_path = r.get("path", "")
        if "/" in p_path:
            p_parent = p_path.rsplit("/", 1)[0]
            nearby = [n for n in rows if n.get("path") == p_parent or n.get("path", "").startswith(p_parent + "/")]
            nearby_text = " ".join(_strip_invisible(n.get("title", "") + " " + n.get("value", "") + " " + n.get("description", "")) for n in nearby).casefold()
            nearby_digits = norm_number(nearby_text)
            if target and len(target) >= 7 and target in nearby_digits:
                return True
            if "instinct" in nearby_text:
                return True
        return False

    if not path:
        if safe_mode:
            raise RuntimeError("BRIDGE_HEADER_PATH not calibrated. No send/read.")
        for r in rows:
            if r.get("role") in ("AXStaticText", "AXButton"):
                if _matches_target(r):
                    return True
        return False

    matches = [r for r in rows if r["path"] == path and r["role"] in ("AXStaticText", "AXButton")]
    if len(matches) != 1:
        if safe_mode:
            raise RuntimeError("Selected chat number/path mismatch. No send/read.")
        return False

    if _matches_target(matches[0]):
        return True

    if safe_mode:
        raise RuntimeError("Selected chat number/path mismatch. No send/read.")
    return False


def dump(rows): return json.dumps(rows, indent=2, ensure_ascii=False)



def _click_voice_cell_play(element, pid):
    """Click the play button icon on a WhatsApp voice message cell.

    In WhatsApp macOS (Catalyst), voice notes are rendered as flat cells
    where the play/pause button is positioned at the left of the bubble.
    Activates WhatsApp briefly, clicks the play button, and restores
    the previous front application and cursor position.
    """
    try:
        import Quartz, time, re
        from ApplicationServices import (
            AXUIElementCopyAttributeValue,
            kCGEventLeftMouseDown, kCGEventLeftMouseUp, kCGMouseButtonLeft, kCGHIDEventTap
        )
        from AppKit import NSRunningApplication

        err, frame_val = AXUIElementCopyAttributeValue(element, "AXFrame", None)
        if err != 0 or not frame_val:
            return False

        m = re.search(r"x:([0-9.\-]+)\s+y:([0-9.\-]+)\s+w:([0-9.\-]+)\s+h:([0-9.\-]+)", str(frame_val))
        if not m:
            return False
        x, y, w, h = (float(v) for v in m.groups())
        click_x = x + 25
        click_y = y + h / 2

        apps = NSRunningApplication.runningApplicationsWithBundleIdentifier_("net.whatsapp.WhatsApp")
        was_hidden = apps[0].isHidden() if apps else False
        cur_pos = Quartz.CGEventGetLocation(Quartz.CGEventCreate(None))
        try:
            activate_whatsapp()
            time.sleep(0.04)
            down = Quartz.CGEventCreateMouseEvent(None, kCGEventLeftMouseDown, (click_x, click_y), kCGMouseButtonLeft)
            up = Quartz.CGEventCreateMouseEvent(None, kCGEventLeftMouseUp, (click_x, click_y), kCGMouseButtonLeft)
            Quartz.CGEventPost(kCGHIDEventTap, down)
            time.sleep(0.04)
            Quartz.CGEventPost(kCGHIDEventTap, up)
        finally:
            Quartz.CGWarpMouseCursorPosition(cur_pos)
            if was_hidden:
                hide_whatsapp()
        return True
    except Exception as exc:
        logging.getLogger("openagent.ax").warning("Voice cell coordinate click failed: %s", exc)
        return False


def press_button(path, expected_label):
    """AXPress one calibrated button by path; refuse stale or changed controls.

    For WhatsApp voice message cells (flat AXStaticText nodes in Catalyst),
    AXPress is a no-op that merely focuses the cell; we additionally perform
    a coordinate click on the play control icon so playback reliably starts.
    """
    if sys.platform != "darwin":
        raise RuntimeError("macOS required")
    from ApplicationServices import (AXUIElementCreateApplication, AXUIElementCopyAttributeValue,
                                     AXUIElementPerformAction)
    pid = get_whatsapp_pid()
    if not pid:
        pid = launch_whatsapp(hide=True)
    if not pid:
        raise RuntimeError("WhatsApp application missing or ambiguous")
    element = AXUIElementCreateApplication(pid)
    try:
        indexes = [int(part) for part in path.split("/")[1:]]
    except ValueError as exc:
        raise RuntimeError("Invalid AX path") from exc
    if not indexes or len(indexes) > 24 or any(i < 0 or i >= 300 for i in indexes):
        raise RuntimeError("Invalid AX path")
    for i in indexes:
        err, children = AXUIElementCopyAttributeValue(element, "AXChildren", None)
        if err != 0 or children is None or i >= len(children):
            raise RuntimeError("AX control path changed")
        element = children[i]
    def attr(name):
        err, value = AXUIElementCopyAttributeValue(element, "AX" + name, None)
        return str(value) if err == 0 and isinstance(value, str) else ""
    role = attr("Role")
    label_full = " ".join(attr(k) for k in ("Title", "Description", "Value")).casefold()
    if role not in ("AXButton", "AXStaticText") or expected_label.casefold() not in label_full:
        raise RuntimeError("AX play control label changed")

    is_voice = "voice message" in label_full or "duration:" in label_full or role == "AXStaticText"
    if is_voice:
        clicked = _click_voice_cell_play(element, pid)
        if clicked:
            return

    if AXUIElementPerformAction(element, "AXPress") != 0:
        raise RuntimeError("AX play action failed")


def ensure_whatsapp_ready(target_name="Instinct", hide_after=True, header_path=None):
    """Ensure WhatsApp is running, target chat is selected, and WhatsApp remains hidden."""
    if sys.platform != "darwin": return False
    pid = get_whatsapp_pid()
    if not pid:
        pid = launch_whatsapp(hide=True)
        if not pid: return False

    import time
    from ApplicationServices import AXUIElementCreateApplication, AXUIElementCopyAttributeValue, AXUIElementPerformAction
    root = AXUIElementCreateApplication(pid)
    _, windows = AXUIElementCopyAttributeValue(root, "AXWindows", None)
    if not windows:
        # Reopen main window via menu
        _, menu_bar = AXUIElementCopyAttributeValue(root, "AXMenuBar", None)
        _, mb_items = AXUIElementCopyAttributeValue(menu_bar, "AXChildren", None)
        for item in mb_items or []:
            _, menus = AXUIElementCopyAttributeValue(item, "AXChildren", None)
            for m in menus or []:
                _, mis = AXUIElementCopyAttributeValue(m, "AXChildren", None)
                for mi in mis or []:
                    _, title = AXUIElementCopyAttributeValue(mi, "AXTitle", None)
                    if "open main window" in (title or "").lower():
                        AXUIElementPerformAction(mi, "AXPress")
                        break
        time.sleep(0.4)

    # Check if target chat is open
    rows = snapshot(safe_mode=False, auto_open=False)
    target_clean = (target_name or "").lower().strip()
    target_digits = norm_number(target_name)
    expected_path = header_path or "/0/0/0/1/2/0/0"

    def is_match(text):
        if not text: return False
        t_low = text.lower()
        if target_clean and target_clean in t_low:
            return True
        if target_digits and len(target_digits) >= 7 and target_digits in norm_number(text):
            return True
        if "instinct" in t_low:
            return True
        return False

    def is_header_open(current_rows):
        return any(
            is_match((r.get("description") or "") + " " + (r.get("title") or "") + " " + (r.get("value") or ""))
            and (r["path"] == expected_path or (not header_path and r["path"].startswith("/0/0/0/1/2/0/")))
            for r in current_rows
        )

    if is_header_open(rows):
        if hide_after:
            hide_whatsapp()
        return True

    # 1. Fast direct URL navigation via whatsapp://send?phone=
    if target_digits and len(target_digits) >= 7:
        try:
            import subprocess
            subprocess.run(["open", "-g", f"whatsapp://send?phone={target_digits}"], check=False, timeout=2.0)
            time.sleep(0.35)
            rows = snapshot(safe_mode=False, auto_open=False)
            if is_header_open(rows):
                if hide_after:
                    hide_whatsapp()
                return True
        except Exception:
            pass

    # 2. Ensure on Chats tab and select matching chat in chat list
    has_chat_list = any(r["path"].startswith("/0/0/0/1/0/1") for r in rows)
    if not has_chat_list:
        _, menu_bar = AXUIElementCopyAttributeValue(root, "AXMenuBar", None)
        if menu_bar:
            _, mb_items = AXUIElementCopyAttributeValue(menu_bar, "AXChildren", None)
            for item in mb_items or []:
                _, menus = AXUIElementCopyAttributeValue(item, "AXChildren", None)
                for m in menus or []:
                    _, mis = AXUIElementCopyAttributeValue(m, "AXChildren", None)
                    for mi in mis or []:
                        _, title = AXUIElementCopyAttributeValue(mi, "AXTitle", None)
                        if title and "chats" in str(title).strip("\u200e").lower():
                            activate_whatsapp()
                            AXUIElementPerformAction(mi, "AXPress")
                            time.sleep(0.2)
                            break
        rows = snapshot(safe_mode=False, auto_open=False)

    items = [
        r for r in rows
        if r["role"] == "AXButton"
        and is_match((r.get("title") or "") + " " + (r.get("description") or "") + " " + (r.get("value") or ""))
        and r["path"].startswith("/0/0/0/1/0/1")
    ]
    if items:
        path = items[0]["path"]
        indexes = [int(p) for p in path.split("/")[1:]]
        el = root
        for idx in indexes:
            _, ch = AXUIElementCopyAttributeValue(el, "AXChildren", None)
            if not ch or idx >= len(ch):
                el = None
                break
            el = ch[idx]
        if el:
            activate_whatsapp()
            time.sleep(0.1)
            AXUIElementPerformAction(el, "AXPress")
            time.sleep(0.25)
            rows = snapshot(safe_mode=False, auto_open=False)

    if hide_after:
        hide_whatsapp()
    return is_header_open(rows)


def click_element_by_description(target_substr, role=None, window_only=True):
    pid = get_whatsapp_pid()
    if not pid:
        pid = launch_whatsapp(hide=True)
    if not pid: return False
    from ApplicationServices import AXUIElementCreateApplication, AXUIElementCopyAttributeValue, AXUIElementPerformAction
    root = AXUIElementCreateApplication(pid)
    rows = snapshot(safe_mode=False)
    target = _strip_invisible(target_substr).lower().strip()

    allowed_roles = (role,) if role else ("AXButton", "AXMenuItem", "AXPopUpButton")

    target_keywords = {target}
    if target in ("file", "document", "documents"):
        target_keywords.update(("file", "document"))
    elif target in ("attach", "share media", "share"):
        target_keywords.update(("attach", "share media"))

    candidates = []
    for r in rows:
        if window_only and not r["path"].startswith("/0/"):
            continue
        if r["role"] not in allowed_roles:
            continue
        desc = _strip_invisible(r.get("description") or "").lower().strip()
        title = _strip_invisible(r.get("title") or "").lower().strip()
        combined = f"{desc} {title}".strip()

        matches = any(kw in desc or kw in title or kw in combined for kw in target_keywords)
        if matches:
            # Score matches: prefer exact match, and prefer popover elements (/0/4)
            is_exact = any(kw == desc or kw == title for kw in target_keywords)
            is_popover = "/0/4" in r["path"]
            score = (3 if is_exact else 1) + (2 if is_popover else 0)
            candidates.append((score, r))

    if not candidates:
        return False

    candidates.sort(key=lambda x: x[0], reverse=True)
    best = candidates[0][1]
    path = best["path"]
    indexes = [int(p) for p in path.split("/")[1:]]
    el = root
    for idx in indexes:
        _, ch = AXUIElementCopyAttributeValue(el, "AXChildren", None)
        if not ch or idx >= len(ch):
            return False
        el = ch[idx]
    return AXUIElementPerformAction(el, "AXPress") == 0


def click_preview_send(timeout=4.0):
    """Wait for WhatsApp attachment preview modal, fire Enter key (key code 36) to send, and verify dismissal."""
    if sys.platform != "darwin":
        return False
    import subprocess, time
    pid = get_whatsapp_pid()
    if not pid:
        pid = launch_whatsapp(hide=True)
    if not pid:
        return False

    saw_preview = False
    t0 = time.monotonic()

    # 1. Wait for WhatsApp attachment preview modal to appear
    while time.monotonic() - t0 < timeout:
        rows = snapshot(safe_mode=False)
        preview_open = any(
            (r["role"] == "AXButton" and "cancel" in _strip_invisible((r.get("description") or "") + " " + (r.get("title") or "")).lower()) or
            (r["role"] == "AXTextArea" and "caption" in _strip_invisible(r.get("description") or "").lower())
            for r in rows
        )
        if preview_open:
            saw_preview = True
            break
        time.sleep(0.02)

    if not saw_preview:
        return False

    # 2. Fire Enter (key code 36) to send attachment and verify preview modal dismisses
    t_enter = time.monotonic()
    last_press = 0.0
    while time.monotonic() - t_enter < 3.0:
        now = time.monotonic()
        if now - last_press >= 0.35:
            subprocess.run([
                "osascript", "-e",
                'tell application "WhatsApp" to activate\n'
                'tell application "System Events" to tell process "WhatsApp"\n'
                '    set frontmost to true\n'
                '    key code 36\n'
                'end tell'
            ], check=False, timeout=1.0)
            last_press = now

        time.sleep(0.04)
        rows_after = snapshot(safe_mode=False)
        still_preview = any(
            (r["role"] == "AXButton" and "cancel" in _strip_invisible((r.get("description") or "") + " " + (r.get("title") or "")).lower()) or
            (r["role"] == "AXTextArea" and "caption" in _strip_invisible(r.get("description") or "").lower())
            for r in rows_after
        )
        if not still_preview:
            return True

    # 3. If preview is still stuck after 3s, safely dismiss Cancel button so WhatsApp is not left blocked
    click_element_by_description("Cancel")
    return False


def focus_composer():
    """Focus WhatsApp message input area using Accessibility API."""
    if sys.platform != "darwin": return False
    from ApplicationServices import AXUIElementCreateApplication, AXUIElementCopyAttributeValue, AXUIElementSetAttributeValue
    pid = get_whatsapp_pid()
    if not pid:
        pid = launch_whatsapp(hide=True)
    if not pid: return False
    root = AXUIElementCreateApplication(pid)
    rows = snapshot(safe_mode=False)
    composers = [r for r in rows if r["role"] == "AXTextArea" and "compose message" in (r.get("description") or "").lower()]
    if not composers:
        composers = [r for r in rows if r["role"] == "AXTextArea"]
    if not composers: return False
    path = composers[0]["path"]
    try:
        indexes = [int(p) for p in path.split("/")[1:]]
        el = root
        for idx in indexes:
            _, ch = AXUIElementCopyAttributeValue(el, "AXChildren", None)
            el = ch[idx]
        return AXUIElementSetAttributeValue(el, "AXFocused", True) == 0
    except Exception:
        return False

