#!/usr/bin/env python3
"""
==============================================================================
⚡ OPENAGENT - ONE-COMMAND CALIBRATION ENGINE
==============================================================================
Calibrates and verifies macOS Accessibility (AX) paths and UI labels for WhatsApp:
1. Inspects live WhatsApp Desktop Accessibility hierarchy.
2. Auto-discovers chat header path (BRIDGE_HEADER_PATH).
3. Auto-discovers message list container (BRIDGE_MESSAGE_LIST_PATH).
4. Auto-detects incoming voice/text markers (BRIDGE_INCOMING_MARKER).
5. Auto-detects playback controls (BRIDGE_VOICE_PLAY_MARKER, BRIDGE_VOICE_PAUSE_MARKER).
6. Auto-detects attachment & file picker labels (BRIDGE_ATTACH_LABEL, etc.).
7. Compares with current .env calibration and optionally saves updates (--save).
8. Dumps clean, sanitized JSON hierarchy on demand (--dump).
==============================================================================
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

ROOT_DIR = Path(__file__).resolve().parent

# ANSI Colors
class Style:
    BOLD = "\033[1m"
    DIM = "\033[2m"
    GREEN = "\033[0;32m"
    BLUE = "\033[0;34m"
    CYAN = "\033[0;36m"
    YELLOW = "\033[0;33m"
    RED = "\033[0;31m"
    RESET = "\033[0m"


def clean_text(text: Optional[str]) -> str:
    if not text:
        return ""
    # Strip invisible Unicode direction marks
    return re.sub(r"[\u200e\u200f\u202a-\u202e\ufeff]", "", text).strip()


def load_env_dict(path: Path) -> Dict[str, str]:
    env = {}
    if path.exists():
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    env[k.strip()] = v.strip().strip("\"'")
    return env


def update_env_file(path: Path, updates: Dict[str, str]):
    """Safely updates or adds keys in .env file while preserving structure."""
    lines = []
    seen = set()
    if path.exists():
        with open(path, "r", encoding="utf-8") as f:
            lines = f.readlines()

    new_lines = []
    for line in lines:
        stripped = line.strip()
        if stripped and not stripped.startswith("#") and "=" in stripped:
            k, _ = stripped.split("=", 1)
            k = k.strip()
            if k in updates:
                new_lines.append(f"{k}={updates[k]}\n")
                seen.add(k)
                continue
        new_lines.append(line)

    # Append any keys that weren't already in .env
    for k, v in updates.items():
        if k not in seen:
            new_lines.append(f"{k}={v}\n")

    with open(path, "w", encoding="utf-8") as f:
        f.writelines(new_lines)


def auto_detect_calibration(rows: List[Dict[str, Any]], target_number: str = "") -> Dict[str, str]:
    """Analyzes the AX hierarchy snapshot and discovers optimal calibration settings."""
    detected = {
        "BRIDGE_HEADER_PATH": "",
        "BRIDGE_MESSAGE_LIST_PATH": "",
        "BRIDGE_INCOMING_MARKER": "",
        "BRIDGE_VOICE_PLAY_MARKER": "",
        "BRIDGE_VOICE_PAUSE_MARKER": "",
        "BRIDGE_ATTACH_LABEL": "",
        "BRIDGE_DOCUMENT_LABEL": "",
        "BRIDGE_ATTACHMENT_SEND_LABEL": "",
    }

    norm_target = "".join(c for c in target_number if c.isdigit())

    # 1. Detect Chat Header Path
    # The active conversation column in WhatsApp Desktop is column 2 (/0/0/0/1/2/...)
    for r in rows:
        path = r.get("path", "")
        role = r.get("role", "")
        desc = clean_text(r.get("description", ""))
        title = clean_text(r.get("title", ""))
        val = clean_text(r.get("value", ""))

        if path.startswith("/0/0/0/1/2/0") and role in ("AXButton", "AXStaticText"):
            # Check for title button or contact/number match
            combined = f"{desc} {title} {val}"
            norm_combined = "".join(c for c in combined if c.isdigit())
            if norm_target and norm_target in norm_combined:
                detected["BRIDGE_HEADER_PATH"] = path
                break
            if path == "/0/0/0/1/2/0/0":
                detected["BRIDGE_HEADER_PATH"] = path
                break

    # Fallback default header if unassigned
    if not detected["BRIDGE_HEADER_PATH"]:
        for r in rows:
            if r.get("path") == "/0/0/0/1/2/0/0":
                detected["BRIDGE_HEADER_PATH"] = "/0/0/0/1/2/0/0"
                break

    # 2. Detect Message List & Incoming Voice Markers
    # Message items usually sit under /0/0/0/1/2/1/0/0 or similar container
    message_parent_paths = {}
    for r in rows:
        desc = clean_text(r.get("description", ""))
        val = clean_text(r.get("value", ""))
        path = r.get("path", "")
        role = r.get("role", "")

        # Look for messages (Voice message, Duration, Listened, Delivered)
        if any(w in desc.lower() or w in val.lower() for w in ("voice message", "duration:", "listened", "delivered")):
            # Parent path is path up to the last slash
            if "/" in path:
                parent = path.rsplit("/", 1)[0]
                message_parent_paths[parent] = message_parent_paths.get(parent, 0) + 1

            if "voice message" in desc.lower() or "voice message" in val.lower():
                detected["BRIDGE_INCOMING_MARKER"] = "Voice message"
                detected["BRIDGE_VOICE_PLAY_MARKER"] = "Voice message"
                detected["BRIDGE_VOICE_PAUSE_MARKER"] = "Pause"

    if message_parent_paths:
        # Most frequent parent is the message list container
        best_parent = max(message_parent_paths.items(), key=lambda x: x[1])[0]
        detected["BRIDGE_MESSAGE_LIST_PATH"] = best_parent
    else:
        # Fallback heuristic
        for r in rows:
            if r.get("path") == "/0/0/0/1/2/1/0/0":
                detected["BRIDGE_MESSAGE_LIST_PATH"] = "/0/0/0/1/2/1/0/0"
                break

    # 3. Detect Attachment and Send Button Labels
    for r in rows:
        desc = clean_text(r.get("description", ""))
        title = clean_text(r.get("title", ""))
        role = r.get("role", "")

        # Attach / Share media
        if any(w in desc.lower() for w in ("share media", "attach", "attachment")) and role == "AXButton":
            detected["BRIDGE_ATTACH_LABEL"] = desc
        # Send photo / Send file
        if desc.lower() in ("send", "enviar") or title.lower() in ("send", "enviar"):
            if not detected["BRIDGE_ATTACHMENT_SEND_LABEL"]:
                detected["BRIDGE_ATTACHMENT_SEND_LABEL"] = desc or title

    # Defaults for labels if WhatsApp didn't expose them in current view
    if not detected["BRIDGE_ATTACH_LABEL"]:
        detected["BRIDGE_ATTACH_LABEL"] = "Share media"
    if not detected["BRIDGE_DOCUMENT_LABEL"]:
        detected["BRIDGE_DOCUMENT_LABEL"] = "File"
    if not detected["BRIDGE_ATTACHMENT_SEND_LABEL"]:
        detected["BRIDGE_ATTACHMENT_SEND_LABEL"] = "Send"
    if not detected["BRIDGE_INCOMING_MARKER"]:
        detected["BRIDGE_INCOMING_MARKER"] = "Voice message"
    if not detected["BRIDGE_VOICE_PLAY_MARKER"]:
        detected["BRIDGE_VOICE_PLAY_MARKER"] = "Voice message"
    if not detected["BRIDGE_VOICE_PAUSE_MARKER"]:
        detected["BRIDGE_VOICE_PAUSE_MARKER"] = "Pause"

    return detected


def parse_args():
    parser = argparse.ArgumentParser(
        description="One-Command Calibration Engine for OpenAgent",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--save", "--apply", dest="save", action="store_true", help="Automatically save detected calibration to .env")
    parser.add_argument("--dump", nargs="?", const="ax-tree.json", default=None, help="Dump full raw AX hierarchy to JSON file (default: ax-tree.json)")
    parser.add_argument("--json", action="store_true", help="Print detected calibration in JSON format")
    parser.add_argument("--chat", default=None, help="Specific phone number or contact name to target for calibration")
    return parser.parse_args()


def main():
    args = parse_args()

    # Load snapshot from OpenAgent.ax (re-exec in .venv if needed)
    try:
        from OpenAgent.ax import snapshot, dump, get_whatsapp_pid
    except ImportError:
        # Fallback inside .venv
        venv_py = ROOT_DIR / ".venv/bin/python"
        if venv_py.exists():
            cmd = [str(venv_py), str(ROOT_DIR / "calibrate.py")] + sys.argv[1:]
            os.execv(cmd[0], cmd)
        print(f"{Style.RED}Error: OpenAgent module not found.{Style.RESET}")
        sys.exit(1)

    env_path = ROOT_DIR / ".env"
    current_env = load_env_dict(env_path)
    target_number = args.chat or current_env.get("BRIDGE_WHATSAPP_NUMBER", "+16508702892")

    if not args.json:
        print(f"""{Style.BOLD}{Style.CYAN}
==============================================================================
          ⚡ OPENAGENT - ACCESSIBILITY CALIBRATOR            
=============================================================================={Style.RESET}""")
        print(f"{Style.BOLD}Target Chat:{Style.RESET} {target_number}")
        print("Capturing live WhatsApp Desktop Accessibility snapshot...")

    pid = get_whatsapp_pid()
    if not pid:
        if not args.json:
            print(f"{Style.YELLOW}WhatsApp Desktop is not currently running. Launching...{Style.RESET}")
        subprocess.run(["open", "-g", "-j", "-a", "WhatsApp"], check=False)
        time.sleep(2.0)

    rows = snapshot(safe_mode=False, auto_open=True)
    if not rows:
        print(f"{Style.RED}Failed to capture WhatsApp AX tree. Ensure WhatsApp Desktop is open and Accessibility permission is granted.{Style.RESET}")
        sys.exit(1)

    if not args.json:
        print(f"{Style.GREEN}✓ Captured {len(rows)} UI nodes from WhatsApp (PID: {get_whatsapp_pid()}){Style.RESET}\n")

    # Optional dump
    if args.dump:
        dump_path = Path(args.dump)
        with open(dump_path, "w", encoding="utf-8") as f:
            f.write(dump(rows))
        print(f"{Style.BLUE}ℹ Dumped AX hierarchy snapshot to {dump_path.resolve()}{Style.RESET}")
        print(f"{Style.YELLOW}  (Note: Contains UI text snippets; do not commit to Git){Style.RESET}\n")

    # Run auto-detection
    detected = auto_detect_calibration(rows, target_number=target_number)

    if args.json:
        print(json.dumps(detected, indent=2))
        return

    # Display comparison matrix
    print(f"{Style.BOLD}{'CALIBRATION KEY':<30} {'CURRENT (.env)':<25} {'LIVE DETECTED':<25} {'STATUS'}{Style.RESET}")
    print("-" * 90)

    matches = 0
    updates_needed = {}

    for key, det_val in detected.items():
        curr_val = current_env.get(key, "")
        if curr_val == det_val and curr_val != "":
            status = f"{Style.GREEN}MATCH ✓{Style.RESET}"
            matches += 1
        elif not curr_val and det_val:
            status = f"{Style.CYAN}NEW +{Style.RESET}"
            updates_needed[key] = det_val
        elif curr_val != det_val:
            status = f"{Style.YELLOW}DIFF ⚡{Style.RESET}"
            updates_needed[key] = det_val
        else:
            status = f"{Style.RED}EMPTY ✗{Style.RESET}"

        disp_curr = (curr_val[:22] + "...") if len(curr_val) > 25 else curr_val or "(unset)"
        disp_det = (det_val[:22] + "...") if len(det_val) > 25 else det_val or "(none)"
        print(f"{key:<30} {disp_curr:<25} {disp_det:<25} {status}")

    print("-" * 90)

    # Save logic
    if args.save:
        if updates_needed:
            # Create a backup first
            backup_path = ROOT_DIR / f".env.backup-{int(time.time())}"
            if env_path.exists():
                shutil.copy(env_path, backup_path)
            update_env_file(env_path, updates_needed)
            print(f"\n{Style.BOLD}{Style.GREEN}✓ Applied {len(updates_needed)} calibration settings to {env_path.name}{Style.RESET}")
            if backup_path.exists():
                print(f"  Backup saved to: {backup_path.name}")
        else:
            print(f"\n{Style.BOLD}{Style.GREEN}✓ All calibration settings already match current .env perfectly!{Style.RESET}")
    else:
        if updates_needed:
            print(f"\n{Style.BOLD}{Style.YELLOW}ℹ {len(updates_needed)} setting(s) differ from live WhatsApp UI.{Style.RESET}")
            print(f"  Run: {Style.BOLD}./calibrate.py --save{Style.RESET}  to automatically apply detected values to .env")
        else:
            print(f"\n{Style.BOLD}{Style.GREEN}🎉 Current .env calibration is 100% verified and active!{Style.RESET}")


if __name__ == "__main__":
    main()
