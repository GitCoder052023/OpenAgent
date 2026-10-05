import os
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import pytest
import calibrate


def test_clean_text():
    assert calibrate.clean_text("\u200eHello\u200f World") == "Hello World"
    assert calibrate.clean_text(None) == ""


def test_auto_detect_calibration():
    fake_rows = [
        {
            "path": "/0/0/0/1/2/0/0",
            "role": "AXButton",
            "title": "",
            "value": "",
            "description": "Instinct",
        },
        {
            "path": "/0/0/0/1/2/1/0/0/1",
            "role": "AXStaticText",
            "title": "",
            "value": "Voice message",
            "description": "Voice message, Duration: 10 seconds",
        },
        {
            "path": "/0/0/0/1/2/1/0/0/2",
            "role": "AXButton",
            "title": "",
            "value": "",
            "description": "Voice message",
        },
        {
            "path": "/0/0/0/1/2/1/0/1",
            "role": "AXButton",
            "title": "",
            "value": "",
            "description": "Share media",
        },
        {
            "path": "/1/4/0/17",
            "role": "AXMenuItem",
            "title": "Send",
            "value": "",
            "description": "Send",
        },
    ]

    detected = calibrate.auto_detect_calibration(fake_rows, target_number="+16508702892")
    assert detected["BRIDGE_HEADER_PATH"] == "/0/0/0/1/2/0/0"
    assert detected["BRIDGE_MESSAGE_LIST_PATH"] == "/0/0/0/1/2/1/0/0"
    assert detected["BRIDGE_INCOMING_MARKER"] == "Voice message"
    assert detected["BRIDGE_VOICE_PLAY_MARKER"] == "Voice message"
    assert detected["BRIDGE_VOICE_PAUSE_MARKER"] == "Pause"
    assert detected["BRIDGE_ATTACH_LABEL"] == "Share media"
    assert detected["BRIDGE_ATTACHMENT_SEND_LABEL"] == "Send"


def test_update_env_file(tmp_path: Path):
    fake_env = tmp_path / ".env"
    fake_env.write_text("BRIDGE_HEADER_PATH=/old/path\nOTHER_KEY=hello\n")

    calibrate.update_env_file(fake_env, {
        "BRIDGE_HEADER_PATH": "/new/path",
        "NEW_CALIBRATION_KEY": "123",
    })

    content = fake_env.read_text()
    assert "BRIDGE_HEADER_PATH=/new/path" in content
    assert "OTHER_KEY=hello" in content
    assert "NEW_CALIBRATION_KEY=123" in content
