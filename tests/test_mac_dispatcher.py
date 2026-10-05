"""Unit tests for dispatching macOS Harness tools in OpenAgent."""

import pytest
from unittest.mock import MagicMock
from OpenAgent.dispatcher import (
    parse_tool_call,
    parse_tool_calls,
    execute_tool_call,
    format_tool_response,
    format_tool_responses,
    encode_tool_call,
)


def test_mac_tools_parsing():
    """Verify parse_tool_call recognizes mac_* and shorthand tools."""
    t1 = encode_tool_call({"tool": "mac_see", "args": {"app": "Safari"}})
    call1 = parse_tool_call(t1)
    assert call1 is not None
    assert call1["tool"] == "mac_see"
    assert call1["args"]["app"] == "Safari"

    t2 = encode_tool_call({"tool": "click", "args": {"x": 100, "y": 200, "app": "Spotify"}})
    call2 = parse_tool_call(t2)
    assert call2 is not None
    assert call2["tool"] == "click"
    assert call2["args"]["x"] == 100

    t3 = '```json\n{"tool": "mac_python", "args": {"code": "print(123)"}}\n```'

    call3 = parse_tool_call(t3)
    assert call3 is not None
    assert call3["tool"] == "mac_python"
    assert call3["args"]["code"] == "print(123)"


def test_execute_mac_python():
    """execute_tool_call executes mac_python scripts."""
    mock_adapter = MagicMock()
    mock_adapter.run_python.return_value = {
        "status": "ok",
        "stdout": "Hello Mac",
        "duration_s": 0.02,
    }

    call = {"tool": "mac_python", "args": {"code": "print('Hello Mac')"}}
    resp = execute_tool_call(None, call, mac_adapter=mock_adapter)
    assert resp["status"] == "ok"
    assert resp["tool"] == "mac_python"
    assert resp["result"]["stdout"] == "Hello Mac"
    mock_adapter.run_python.assert_called_once_with(code="print('Hello Mac')", timeout=30.0)


def test_execute_mac_see_and_shorthand():
    """execute_tool_call executes mac_see and 'see' shorthand."""
    mock_adapter = MagicMock()
    mock_adapter.see.return_value = {
        "app": "Spotify",
        "width": 1280,
        "height": 800,
        "screenshot_path": "/tmp/spot.png",
        "_send_attachment": "/tmp/spot.png",
    }

    call = {"tool": "see", "args": {"app": "Spotify", "send_image": True}}
    resp = execute_tool_call(None, call, mac_adapter=mock_adapter)
    assert resp["status"] == "ok"
    assert resp["result"]["_send_attachment"] == "/tmp/spot.png"
    mock_adapter.see.assert_called_once_with(
        app="Spotify",
        window_index=0,
        max_width=1280,
        max_height=1280,
        send_image=True,
        include_summary=True,
    )


def test_execute_mac_click_and_shorthand():
    """execute_tool_call executes mac_click."""
    mock_adapter = MagicMock()
    mock_adapter.click.return_value = {
        "status": "ok",
        "x": 300.0,
        "y": 400.0,
        "app": "Chrome",
        "button": "left",
    }

    call = {"tool": "click", "args": {"x": 300, "y": 400, "app": "Chrome"}}
    resp = execute_tool_call(None, call, mac_adapter=mock_adapter)
    assert resp["status"] == "ok"
    mock_adapter.click.assert_called_once_with(
        x=300.0,
        y=400.0,
        app="Chrome",
        button="left",
        click_count=1,
    )


def test_execute_mac_type_and_key():
    """execute_tool_call executes mac_type and mac_key."""
    mock_adapter = MagicMock()
    mock_adapter.type.return_value = {"status": "ok", "length": 5}
    mock_adapter.key.return_value = {"status": "ok", "key": "cmd+t"}

    resp1 = execute_tool_call(None, {"tool": "type", "args": {"text": "Hello", "app": "Notes"}}, mac_adapter=mock_adapter)
    assert resp1["status"] == "ok"
    mock_adapter.type.assert_called_once_with(text="Hello", app="Notes")

    resp2 = execute_tool_call(None, {"tool": "key", "args": {"key": "cmd+t", "app": "Safari"}}, mac_adapter=mock_adapter)
    assert resp2["status"] == "ok"
    mock_adapter.key.assert_called_once_with(key="cmd+t", app="Safari")


def test_execute_mac_apps_and_windows():
    """execute_tool_call executes mac_apps and mac_windows."""
    mock_adapter = MagicMock()
    mock_adapter.list_apps.return_value = [{"name": "Finder", "pid": 123}]
    mock_adapter.windows.return_value = [{"title": "My Window"}]

    resp_apps = execute_tool_call(None, {"tool": "apps", "args": {}}, mac_adapter=mock_adapter)
    assert resp_apps["status"] == "ok"
    assert resp_apps["result"]["total"] == 1

    resp_wins = execute_tool_call(None, {"tool": "windows", "args": {"app": "Finder"}}, mac_adapter=mock_adapter)
    assert resp_wins["status"] == "ok"
    assert resp_wins["result"]["total"] == 1


def test_format_mac_responses():
    """format_tool_response produces human-readable WhatsApp markdown for mac_* tools."""
    # mac_python
    r_py = {
        "status": "ok",
        "tool": "mac_python",
        "result": {"stdout": "Line 1\nLine 2", "duration_s": 0.05},
    }
    fmt_py = format_tool_response(r_py)
    assert "Burst execution (0.05s):" in fmt_py
    assert "Line 1" in fmt_py

    # mac_see
    r_see = {
        "status": "ok",
        "tool": "mac_see",
        "result": {
            "app": "Spotify",
            "window_index": 0,
            "width": 1280,
            "height": 800,
            "_send_attachment": "/tmp/spot.png",
            "interactive_controls": ["AXButton: 'Play' at (50,50)"],
        },
    }
    fmt_see = format_tool_response(r_see)
    assert "Captured 'Spotify'" in fmt_see
    assert "attachment queued" in fmt_see
    assert "AXButton: 'Play'" in fmt_see

    # mac_click
    r_click = {
        "status": "ok",
        "tool": "mac_click",
        "result": {"x": 200.0, "y": 300.0, "app": "Spotify", "button": "left", "click_count": 1},
    }
    fmt_click = format_tool_response(r_click)
    assert "Clicked (200.0, 300.0) on Spotify" in fmt_click

    # mac_apps
    r_apps = {
        "status": "ok",
        "tool": "mac_apps",
        "result": {"apps": [{"name": "Finder", "pid": 100}, {"name": "Chrome", "pid": 200}], "total": 2},
    }
    fmt_apps = format_tool_response(r_apps)
    assert "Running Applications (2):" in fmt_apps
    assert "• Finder (PID 100)" in fmt_apps
