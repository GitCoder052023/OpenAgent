"""macOS Accessibility inspection. UI layout must be calibrated locally."""
import json
import sys


def get_whatsapp_pid():
    if sys.platform != "darwin": return None
    try:
        from AppKit import NSWorkspace
        running = [a for a in NSWorkspace.sharedWorkspace().runningApplications()
                   if "whatsapp" in (a.localizedName() or "").lower() and "autofill" not in (a.localizedName() or "").lower()]
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
        from AppKit import NSWorkspace, NSApplicationActivateIgnoringOtherApps
        running = [a for a in NSWorkspace.sharedWorkspace().runningApplications()
                   if "whatsapp" in (a.localizedName() or "").lower() and "autofill" not in (a.localizedName() or "").lower()]
        if running:
            running[0].activateWithOptions_(NSApplicationActivateIgnoringOtherApps)
            return True
    except Exception:
        pass
    return False


def hide_whatsapp():
    """Hide WhatsApp application to keep user screen completely clean and private."""
    if sys.platform != "darwin": return False
    try:
        from AppKit import NSWorkspace
        running = [a for a in NSWorkspace.sharedWorkspace().runningApplications()
                   if "whatsapp" in (a.localizedName() or "").lower() and "autofill" not in (a.localizedName() or "").lower()]
        if running:
            running[0].hide()
            return True
    except Exception:
        pass
    return False


def snapshot(safe_mode=True):
    if sys.platform != "darwin":
        raise RuntimeError("macOS required")
    from ApplicationServices import AXUIElementCreateApplication, AXUIElementCopyAttributeValue
    pid = get_whatsapp_pid()
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
    # and verify that the target phone number is confirmed in the visible chat content
    header_text = " ".join(matches[0].get(k, "") for k in ("title", "value", "description")).casefold()
    has_target_in_chat = bool(target and any(target in norm_number(r.get("value", "") + r.get("description", "")) for r in rows))

    if header_text and (("instinct" in header_text or number.casefold() in header_text) and has_target_in_chat):
        return True

    if not safe_mode:
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


def ensure_whatsapp_ready(target_name="Instinct"):
    """Ensure WhatsApp window is open, activated, and the target chat is selected."""
    if sys.platform != "darwin": return False
    pid = get_whatsapp_pid()
    if not pid: return False
    activate_whatsapp()
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
        import time; time.sleep(0.4)
    # Check if target chat is open
    rows = snapshot(safe_mode=False)
    header_found = any(target_name.lower() in (r.get("description") or "").lower() and r["path"] == "/0/0/0/1/2/0/0" for r in rows)
    if not header_found:
        items = [r for r in rows if r["role"] == "AXButton" and target_name.lower() in (r.get("title") or r.get("description") or "").lower() and r["path"].startswith("/0/0/0/1/0/1")]
        if items:
            path = items[0]["path"]
            indexes = [int(p) for p in path.split("/")[1:]]
            el = root
            for idx in indexes:
                _, ch = AXUIElementCopyAttributeValue(el, "AXChildren", None)
                el = ch[idx]
            AXUIElementPerformAction(el, "AXPress")
            import time; time.sleep(0.3)
    return True


def click_element_by_description(target_substr, role="AXButton"):
    pid = get_whatsapp_pid()
    if not pid: return False
    from ApplicationServices import AXUIElementCreateApplication, AXUIElementCopyAttributeValue, AXUIElementPerformAction
    root = AXUIElementCreateApplication(pid)
    rows = snapshot(safe_mode=False)
    matches = [r for r in rows if r["role"] == role and target_substr.lower() in (r.get("description") or r.get("title") or "").lower()]
    if not matches: return False
    path = matches[0]["path"]
    indexes = [int(p) for p in path.split("/")[1:]]
    el = root
    for idx in indexes:
        _, ch = AXUIElementCopyAttributeValue(el, "AXChildren", None)
        el = ch[idx]
    return AXUIElementPerformAction(el, "AXPress") == 0


def click_preview_send(timeout=4.0):
    """Wait for WhatsApp attachment preview, focus caption field, and press Enter to dispatch."""
    if sys.platform != "darwin": return False
    from ApplicationServices import (AXUIElementCreateApplication, AXUIElementCopyAttributeValue,
                                     AXUIElementSetAttributeValue, AXValueGetValue,
                                     kAXValueTypeCGPoint, kAXValueTypeCGSize)
    import subprocess, time, Quartz
    pid = get_whatsapp_pid()
    if not pid: return False
    root = AXUIElementCreateApplication(pid)

    t0 = time.monotonic()
    while time.monotonic() - t0 < timeout:
        rows = snapshot(safe_mode=False)
        captions = [r for r in rows if r["role"] == "AXTextArea" and ("caption" in (r.get("description") or "").lower() or r["path"].startswith("/0/0/0"))]
        send_btns = [r for r in rows if r["role"] == "AXButton" and "send" in (r.get("description") or r.get("title") or "").lower() and "voice" not in (r.get("description") or "").lower()]

        if captions or send_btns:
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
                            return True
        time.sleep(0.1)

    return True


def focus_composer():
    """Focus WhatsApp message input area using Accessibility API."""
    if sys.platform != "darwin": return False
    from ApplicationServices import AXUIElementCreateApplication, AXUIElementCopyAttributeValue, AXUIElementSetAttributeValue
    pid = get_whatsapp_pid()
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
