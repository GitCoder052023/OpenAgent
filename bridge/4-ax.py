"""macOS Accessibility inspection. UI layout must be calibrated locally."""
import json
import sys


def snapshot():
    if sys.platform != "darwin":
        raise RuntimeError("macOS required")
    import Quartz
    from ApplicationServices import AXUIElementCreateApplication, AXUIElementCopyAttributeValue
    apps = [a for a in Quartz.CGWindowListCopyWindowInfo(Quartz.kCGWindowListOptionOnScreenOnly, Quartz.kCGNullWindowID)
            if a.get("kCGWindowOwnerName") == "WhatsApp" and a.get("kCGWindowOwnerPID")]
    if not apps:
        raise RuntimeError("WhatsApp Desktop must be open and visible")
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


def verify_header(rows, number, path):
    """A locally calibrated exact path to the selected chat's number label."""
    if not path: raise RuntimeError("BRIDGE_HEADER_PATH not calibrated. No send/read.")
    matches = [r for r in rows if r["path"] == path and r["role"] in ("AXStaticText", "AXButton")]
    if len(matches) != 1 or not any(norm_number(matches[0][k]) == norm_number(number)
                                    for k in ("title", "value", "description")):
        raise RuntimeError("Selected chat number/path mismatch. No send/read.")
    return True


def dump(rows): return json.dumps(rows, indent=2, ensure_ascii=False)



def press_button(path, expected_label):
    """AXPress one calibrated button by path; refuse stale or changed controls."""
    if sys.platform != "darwin":
        raise RuntimeError("macOS required")
    import Quartz
    from ApplicationServices import (AXUIElementCreateApplication, AXUIElementCopyAttributeValue,
                                     AXUIElementPerformAction)
    apps = [a for a in Quartz.CGWindowListCopyWindowInfo(Quartz.kCGWindowListOptionOnScreenOnly, Quartz.kCGNullWindowID)
            if a.get("kCGWindowOwnerName") == "WhatsApp" and a.get("kCGWindowOwnerPID")]
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
    if attr("Role") != "AXButton" or expected_label.casefold() not in " ".join(attr(k) for k in ("Title", "Description", "Value")).casefold():
        raise RuntimeError("AX play control label changed")
    if AXUIElementPerformAction(element, "AXPress") != 0:
        raise RuntimeError("AX play action failed")
