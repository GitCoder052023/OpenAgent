"""macOS Accessibility inspection. UI layout must be calibrated locally."""
import json
import sys


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
    try:
        from AppKit import NSRunningApplication, NSApplicationActivateIgnoringOtherApps
        apps = NSRunningApplication.runningApplicationsWithBundleIdentifier_("net.whatsapp.WhatsApp")
        if apps:
            apps[0].activateWithOptions_(NSApplicationActivateIgnoringOtherApps)
            return True
    except Exception:
        pass
    try:
        from AppKit import NSWorkspace, NSApplicationActivateIgnoringOtherApps
        running = [a for a in NSWorkspace.sharedWorkspace().runningApplications()
                   if _is_whatsapp_process(a)]
        if running:
            running[0].activateWithOptions_(NSApplicationActivateIgnoringOtherApps)
            return True
    except Exception:
        pass
    return False


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
    def value(el, attr):
        err, val = AXUIElementCopyAttributeValue(el, attr, None)
        return val if err == 0 else None
    def walk(el, path="", depth=0):
        if depth > 24 or len(rows) > 2500: return
        row = {"path": path, "depth": depth}
        for attr in ("Role", "Title", "Value", "Description"):
            raw = value(el, "AX" + attr)
            row[attr.lower()] = str(raw or "")[:1500] if isinstance(raw, str) else ""
        rows.append(row)
        for i, child in enumerate(list(value(el, "AXChildren") or [])[:300]):
            walk(child, f"{path}/{i}", depth + 1)
    walk(root)
    return rows


def norm_number(value): return "".join(c for c in value if c.isdigit())


_warned_relaxed_chats = set()


def verify_header(rows, number, path, safe_mode=True):
    """Verify chat header. In safe mode, requires locally calibrated exact path."""
    if not path:
        if safe_mode:
            raise RuntimeError("BRIDGE_HEADER_PATH not calibrated. No send/read.")
        return True

    matches = [r for r in rows if r["path"] == path and r["role"] in ("AXStaticText", "AXButton")]
    if len(matches) != 1:
        if safe_mode:
            raise RuntimeError("Selected chat number/path mismatch. No send/read.")
        return False

    target = norm_number(number)
    # Check if normalized number is directly in the header element
    if target and any(target in norm_number(matches[0][k]) for k in ("title", "value", "description")):
        return True

    # If contact is saved under a display name (e.g. "Instinct"), check if header contains the name
    # and verify the target phone number in the header's OWN container (subtitle/number line) -
    # not anywhere in visible chat content, where an old quoted message could spoof it.
    header_text = " ".join(matches[0].get(k, "") for k in ("title", "value", "description")).casefold()
    header_parent = matches[0]["path"].rsplit("/", 1)[0]
    nearby = [r for r in rows if r["path"] == header_parent or r["path"].startswith(header_parent + "/")]
    has_target_near_header = bool(target and any(
        target in norm_number(r.get("title", "") + r.get("value", "") + r.get("description", ""))
        for r in nearby))

    if header_text and (("instinct" in header_text or number.casefold() in header_text) and has_target_near_header):
        return True

    if not safe_mode:
        if header_text and ("instinct" in header_text or number.casefold() in header_text):
            return True
        if number not in _warned_relaxed_chats:
            _warned_relaxed_chats.add(number)
            print(f"Warning (unlocked mode): Active chat verification relaxed for {number}.")
        return True

    raise RuntimeError("Selected chat number/path mismatch. No send/read.")


def dump(rows): return json.dumps(rows, indent=2, ensure_ascii=False)



def press_button(path, expected_label):
    """AXPress one calibrated button by path; refuse stale or changed controls."""
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
    if attr("Role") not in ("AXButton", "AXStaticText") or expected_label.casefold() not in " ".join(attr(k) for k in ("Title", "Description", "Value")).casefold():
        raise RuntimeError("AX play control label changed")
    if AXUIElementPerformAction(element, "AXPress") != 0:
        raise RuntimeError("AX play action failed")


def ensure_whatsapp_ready(target_name="Instinct", hide_after=True):
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

    header_found = any(
        is_match((r.get("description") or "") + " " + (r.get("title") or ""))
        and r["path"] == "/0/0/0/1/2/0/0"
        for r in rows
    )
    if not header_found:
        # Ensure we are on Chats tab
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
                                hide_whatsapp()
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
                time.sleep(0.2)
                hide_whatsapp()

    if hide_after:
        hide_whatsapp()
    return True


def click_element_by_description(target_substr, role="AXButton"):
    pid = get_whatsapp_pid()
    if not pid:
        pid = launch_whatsapp(hide=True)
    if not pid: return False
    from ApplicationServices import AXUIElementCreateApplication, AXUIElementCopyAttributeValue, AXUIElementPerformAction
    root = AXUIElementCreateApplication(pid)
    rows = snapshot(safe_mode=False)
    target = target_substr.lower().strip()
    valid_roles = (role, "AXButton", "AXMenuItem") if role == "AXButton" else (role,)
    matches = [
        r for r in rows
        if r["role"] in valid_roles
        and (target in (r.get("description") or "").strip("\u200e").lower()
             or target in (r.get("title") or "").strip("\u200e").lower())
    ]
    if not matches: return False
    path = matches[0]["path"]
    indexes = [int(p) for p in path.split("/")[1:]]
    el = root
    for idx in indexes:
        _, ch = AXUIElementCopyAttributeValue(el, "AXChildren", None)
        if not ch or idx >= len(ch):
            return False
        el = ch[idx]
    return AXUIElementPerformAction(el, "AXPress") == 0


def click_preview_send(timeout=4.0):
    """Wait for WhatsApp attachment preview, focus caption field, and press Enter to dispatch.

    Returns True only when a preview (caption field or Cancel button) was
    actually seen and then dismissed. Returns False on timeout so the caller's
    commit-audio fallback can run; previously this always returned True.
    """
    if sys.platform != "darwin": return False
    from ApplicationServices import (AXUIElementCreateApplication, AXUIElementCopyAttributeValue,
                                     AXUIElementSetAttributeValue, AXValueGetValue,
                                     kAXValueTypeCGPoint, kAXValueTypeCGSize)
    import subprocess, time, Quartz
    pid = get_whatsapp_pid()
    if not pid:
        pid = launch_whatsapp(hide=True)
    if not pid: return False
    root = AXUIElementCreateApplication(pid)

    saw_preview = False
    t0 = time.monotonic()
    while time.monotonic() - t0 < timeout:
        rows = snapshot(safe_mode=False)
        # Caption field only exists in the attachment preview; never match the
        # main-window composer by path alone.
        captions = [r for r in rows if r["role"] == "AXTextArea" and "caption" in (r.get("description") or "").lower()]
        cancel_btns = [r for r in rows if r["role"] == "AXButton" and "cancel" in (r.get("description") or r.get("title") or "").lower()]
        preview_open = bool(captions or cancel_btns)
        send_btns = [r for r in rows if r["role"] == "AXButton" and "send" in (r.get("description") or r.get("title") or "").lower() and "voice" not in (r.get("description") or "").lower()] if preview_open else []

        if preview_open:
            saw_preview = True
            # 1. Focus the caption text field
            if captions:
                path = captions[0]["path"]
                indexes = [int(p) for p in path.split("/")[1:]]
                el = root
                for idx in indexes:
                    _, ch = AXUIElementCopyAttributeValue(el, "AXChildren", None)
                    if not ch or idx >= len(ch):
                        el = None
                        break
                    el = ch[idx]
                if el:
                    AXUIElementSetAttributeValue(el, "AXFocused", True)
                    time.sleep(0.05)

            # 2. Press Enter (key code 36) in WhatsApp
            subprocess.run(["osascript", "-e", 'tell application "System Events" to tell process "WhatsApp" to key code 36'], check=False)
            time.sleep(0.2)

            # Check if preview dismissed
            rows_after = snapshot(safe_mode=False)
            still_preview = any(r["role"] == "AXButton" and "cancel" in (r.get("description") or "").lower() for r in rows_after)
            if not still_preview:
                return True

            # 3. Fallback: Click Send button by screen coordinates
            if send_btns:
                path = send_btns[0]["path"]
                indexes = [int(p) for p in path.split("/")[1:]]
                el = root
                for idx in indexes:
                    _, ch = AXUIElementCopyAttributeValue(el, "AXChildren", None)
                    if not ch or idx >= len(ch):
                        el = None
                        break
                    el = ch[idx]
                if el:
                    _, pos_val = AXUIElementCopyAttributeValue(el, "AXPosition", None)
                    _, size_val = AXUIElementCopyAttributeValue(el, "AXSize", None)
                    if pos_val and size_val:
                        ok1, point = AXValueGetValue(pos_val, kAXValueTypeCGPoint, None)
                        ok2, size = AXValueGetValue(size_val, kAXValueTypeCGSize, None)
                        if ok1 and ok2:
                            x = point.x + size.width / 2.0
                            y = point.y + size.height / 2.0
                            down = Quartz.CGEventCreateMouseEvent(None, Quartz.kCGEventLeftMouseDown, Quartz.CGPoint(x, y), Quartz.kCGMouseButtonLeft)
                            up = Quartz.CGEventCreateMouseEvent(None, Quartz.kCGEventLeftMouseUp, Quartz.CGPoint(x, y), Quartz.kCGMouseButtonLeft)
                            Quartz.CGEventPost(Quartz.kCGHIDEventTap, down)
                            time.sleep(0.05)
                            Quartz.CGEventPost(Quartz.kCGHIDEventTap, up)
                            time.sleep(0.2)
                            rows_after = snapshot(safe_mode=False)
                            still_preview = any(r["role"] == "AXButton" and "cancel" in (r.get("description") or "").lower() for r in rows_after)
                            if not still_preview:
                                return True
        elif saw_preview:
            # Preview was open on an earlier poll and is now gone: dispatched.
            return True
        time.sleep(0.1)

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
