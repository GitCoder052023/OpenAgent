"""macOS Accessibility inspection. UI layout must be calibrated locally."""
import json
import sys


def snapshot(safe_mode=True):
    if sys.platform != "darwin":
        raise RuntimeError("macOS required")
    import Quartz
    from ApplicationServices import AXUIElementCreateApplication, AXUIElementCopyAttributeValue
    apps = [a for a in Quartz.CGWindowListCopyWindowInfo(Quartz.kCGWindowListOptionOnScreenOnly, Quartz.kCGNullWindowID)
            if str(a.get("kCGWindowOwnerName", "")).strip("\u200e").lower() == "whatsapp" and a.get("kCGWindowOwnerPID")]
    if not apps:
        if safe_mode:
            raise RuntimeError("WhatsApp Desktop must be open and visible")
        print("Warning: WhatsApp Desktop must be open and visible")
        return []
    root = AXUIElementCreateApplication(apps[0]["kCGWindowOwnerPID"])
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
    import Quartz
    from ApplicationServices import (AXUIElementCreateApplication, AXUIElementCopyAttributeValue,
                                     AXUIElementPerformAction)
    apps = [a for a in Quartz.CGWindowListCopyWindowInfo(Quartz.kCGWindowListOptionOnScreenOnly, Quartz.kCGNullWindowID)
            if str(a.get("kCGWindowOwnerName", "")).strip("\u200e").lower() == "whatsapp" and a.get("kCGWindowOwnerPID")]
    if len({a["kCGWindowOwnerPID"] for a in apps}) != 1:
        raise RuntimeError("WhatsApp application missing or ambiguous")
    element = AXUIElementCreateApplication(apps[0]["kCGWindowOwnerPID"])
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


def focus_composer():
    """Focus WhatsApp message input area using Accessibility API."""
    if sys.platform != "darwin": return False
    import Quartz
    from ApplicationServices import AXUIElementCreateApplication, AXUIElementCopyAttributeValue, AXUIElementSetAttributeValue
    apps = [a for a in Quartz.CGWindowListCopyWindowInfo(Quartz.kCGWindowListOptionOnScreenOnly, Quartz.kCGNullWindowID)
            if str(a.get("kCGWindowOwnerName", "")).strip("\u200e").lower() == "whatsapp" and a.get("kCGWindowOwnerPID")]
    if not apps: return False
    root = AXUIElementCreateApplication(apps[0]["kCGWindowOwnerPID"])
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
