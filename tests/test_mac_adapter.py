"""Unit and integration tests for MacAdapter in OpenAgent."""

import pytest
from unittest.mock import MagicMock, patch
from macos_harness.macos import MacOSError
from OpenAgent.mac_adapter import MacAdapter, _check_target_allowed, PROHIBITED_TARGETS


def test_whatsapp_target_allowed():
    """Ensure targeting WhatsApp Desktop is permitted without restriction."""
    for target in ("WhatsApp", "whatsapp", "WhatsApp.app", "net.whatsapp.WhatsApp", "com.apple.WhatsApp"):
        _check_target_allowed(target)

    # Allowed targets should not raise
    _check_target_allowed("Safari")
    _check_target_allowed("Spotify")
    _check_target_allowed("Finder")
    _check_target_allowed(None)


def test_custom_prohibited_targets_enforced():
    """Ensure explicitly configured prohibited targets raise MacOSError."""
    with patch("OpenAgent.mac_adapter.PROHIBITED_TARGETS", {"restricted_app"}):
        with pytest.raises(MacOSError, match="prohibited"):
            _check_target_allowed("restricted_app")


def test_mac_adapter_doctor():
    """Doctor check returns expected structure."""
    adapter = MacAdapter()
    doc = adapter.doctor()
    assert isinstance(doc, dict)
    assert doc.get("platform") == "macOS"
    assert "permissions" in doc


def test_mac_adapter_run_python_success():
    """run_python executes valid Python scripts and captures output."""
    adapter = MacAdapter()
    res = adapter.run_python("print('Hello from test!'); y = 5 * 10; print(f'y={y}')")
    assert res["status"] == "ok"
    assert "Hello from test!" in res["stdout"]
    assert "y=50" in res["stdout"]
    assert "duration_s" in res


def test_mac_adapter_run_python_error():
    """run_python gracefully captures runtime errors in scripts."""
    adapter = MacAdapter()
    res = adapter.run_python("raise ZeroDivisionError('cannot divide by zero')")
    assert res["status"] == "error"
    assert "ZeroDivisionError" in res["error"]


def test_mac_adapter_run_python_empty():
    """Empty code raises ValueError."""
    adapter = MacAdapter()
    with pytest.raises(ValueError):
        adapter.run_python("")


def test_mac_adapter_operates_whatsapp():
    """Verify MacAdapter allows operating WhatsApp Desktop without raising target errors."""
    mock_mac = MagicMock()
    mock_mac.see.return_value = {"app": "WhatsApp", "path": "/tmp/wa.png"}
    adapter = MacAdapter(mac=mock_mac)

    res_click = adapter.click(100, 100, app="WhatsApp")
    assert res_click["status"] == "ok"
    mock_mac.click.assert_called_once_with(100.0, 100.0, app="WhatsApp", button="left", click_count=1)

    res_type = adapter.type("hello", app="WhatsApp")
    assert res_type["status"] == "ok"
    mock_mac.type.assert_called_once_with("hello", app="WhatsApp")

    res_key = adapter.key("cmd+w", app="WhatsApp")
    assert res_key["status"] == "ok"
    mock_mac.key.assert_called_once_with("cmd+w", app="WhatsApp")

    res_see = adapter.see(app="WhatsApp", include_summary=False)
    assert res_see["app"] == "WhatsApp"
    mock_mac.see.assert_called_once()


def test_mac_adapter_input_delegation():
    """Adapter forwards primitives to underlying MacOS instance."""
    mock_mac = MagicMock()
    adapter = MacAdapter(mac=mock_mac)

    res_click = adapter.click(200, 300, app="Spotify", button="left", click_count=2)
    mock_mac.click.assert_called_once_with(200.0, 300.0, app="Spotify", button="left", click_count=2)
    assert res_click["status"] == "ok"

    res_move = adapter.move(150, 250, app="Safari")
    mock_mac.move.assert_called_once_with(150.0, 250.0, app="Safari")
    assert res_move["status"] == "ok"

    res_type = adapter.type("Hello world", app="Notes")
    mock_mac.type.assert_called_once_with("Hello world", app="Notes")
    assert res_type["status"] == "ok"

    res_key = adapter.key("cmd+k", app="Spotify")
    mock_mac.key.assert_called_once_with("cmd+k", app="Spotify")
    assert res_key["status"] == "ok"

    res_drag = adapter.drag(10, 20, 100, 200, app="Finder")
    mock_mac.drag.assert_called_once_with(10.0, 20.0, 100.0, 200.0, app="Finder", duration=0.35, button="left")
    assert res_drag["status"] == "ok"

    res_scroll = adapter.scroll(50, 50, dx=0, dy=-5, app="Safari")
    mock_mac.scroll.assert_called_once_with(50.0, 50.0, dx=0, dy=-5, app="Safari")
    assert res_scroll["status"] == "ok"


def test_mac_adapter_see_attachment_signal():
    """When send_image=True, see returns attachment delivery signal."""
    mock_mac = MagicMock()
    mock_mac.see.return_value = {
        "path": "/tmp/screenshot.png",
        "app": "Safari",
        "width": 1280,
        "height": 800,
        "bounds": {"x": 0, "y": 0, "width": 1280, "height": 800},
    }
    mock_mac.get_app_state.return_value = {"nodes": []}

    adapter = MacAdapter(mac=mock_mac)
    res = adapter.see(app="Safari", send_image=True, include_summary=True)
    assert res["screenshot_path"] == "/tmp/screenshot.png"
    assert res["_send_attachment"] == "/tmp/screenshot.png"
    assert res["app"] == "Safari"


def test_mac_adapter_apps_and_windows():
    """Listing apps and windows correctly formats items."""
    mock_mac = MagicMock()
    mock_mac.list_apps.return_value = [
        {"name": "Finder", "bundle_id": "com.apple.finder", "pid": 100},
        {"name": "Safari", "bundle_id": "com.apple.Safari", "pid": 200},
    ]
    mock_mac.windows.return_value = [
        {"window_id": 1, "title": "Home", "bounds": {"x": 0, "y": 0, "width": 800, "height": 600}},
    ]

    adapter = MacAdapter(mac=mock_mac)
    apps = adapter.list_apps()
    assert len(apps) == 2
    assert apps[0]["name"] == "Finder"

    wins = adapter.windows(app="Finder")
    assert len(wins) == 1
    assert wins[0]["title"] == "Home"


def test_mac_adapter_ax_operations():
    """Accessibility actions route properly to mac.ax."""
    mock_mac = MagicMock()
    mock_mac.ax = MagicMock()
    adapter = MacAdapter(mac=mock_mac)

    # at
    mock_mac.ax.at.return_value = {"role": "AXButton", "title": "Play"}
    res_at = adapter.ax("at", x=50, y=50, app="Spotify")
    mock_mac.ax.at.assert_called_once_with(50.0, 50.0, app="Spotify")
    assert res_at["role"] == "AXButton"

    # query
    mock_mac.ax.query.return_value = [{"role": "AXButton", "title": "Search"}]
    res_query = adapter.ax("query", text="Search", app="Spotify")
    assert len(res_query) == 1

    # perform
    res_perf = adapter.ax("perform", element_index=3, element_action="AXPress")
    mock_mac.perform_action.assert_called_once_with(3, action="AXPress")
    assert res_perf["status"] == "ok"
