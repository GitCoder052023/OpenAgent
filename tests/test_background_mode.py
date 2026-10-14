"""Unit tests for OpenAgent Zero-Focus Background Operation (Ghost Mode).

Verifies that:
1. Config parses background_mode, headless_browser, and restore_focus flags.
2. BrowserAdapter exposes focus emulation (CDP Emulation.setFocusEmulationEnabled)
   and tags operations as background isolated.
3. MacAdapter protects user focus using preserve_user_focus and provides smart_click (AXPress).
4. SkillsAdapter provides native AppleScript fallback for Spotify and Apple Music playback without window focus.
5. LocoAdapter setup_chrome supports headless flags and background isolated status.
6. Desktop captures and restores active application focus around message dispatch.
"""

import os
from unittest.mock import MagicMock, patch
import pytest

from OpenAgent.config import Config
from OpenAgent.browser_adapter import BrowserAdapter
from OpenAgent.mac_adapter import MacAdapter, preserve_user_focus
from OpenAgent.skills_adapter import SkillsAdapter
from OpenAgent.loco_adapter import LocoAdapter
from OpenAgent.desktop import Desktop


def test_config_background_defaults_and_env():
    """Verify Config correctly loads background-mode flags."""
    cfg_default = Config()
    assert cfg_default.background_mode is True
    assert cfg_default.headless_browser is False
    assert cfg_default.restore_focus is True

    with patch.dict(os.environ, {
        "OPENAGENT_BACKGROUND_MODE": "false",
        "OPENAGENT_HEADLESS": "true",
        "OPENAGENT_RESTORE_FOCUS": "false",
    }):
        cfg_custom = Config.from_env()
        assert cfg_custom.background_mode is False
        assert cfg_custom.headless_browser is True
        assert cfg_custom.restore_focus is False


def test_browser_adapter_focus_emulation():
    """Verify BrowserAdapter activates CDP focus emulation for background tabs."""
    mock_helpers = MagicMock()
    mock_helpers.cdp.return_value = {}
    mock_helpers.page_info.return_value = {"url": "https://x.com", "title": "X"}

    adapter = BrowserAdapter(helpers=mock_helpers)

    # 1. Direct focus emulation
    res = adapter.set_focus_emulation(True)
    assert res["status"] == "ok"
    assert res["focus_emulated"] is True
    mock_helpers.cdp.assert_called_with("Emulation.setFocusEmulationEnabled", enabled=True)

    # 2. Open navigates and auto-emulates focus in background
    open_res = adapter.open("https://x.com")
    assert open_res["status"] == "ok"
    assert open_res["background_isolated"] is True


def test_mac_adapter_preserve_user_focus_restores_frontmost():
    """Verify preserve_user_focus restores the previously frontmost application."""
    mock_front_before = MagicMock()
    mock_front_before.processIdentifier.return_value = 100

    mock_front_after = MagicMock()
    mock_front_after.processIdentifier.return_value = 200

    mock_ws = MagicMock()
    mock_ws.frontmostApplication.side_effect = [mock_front_before, mock_front_after]

    mock_appkit = MagicMock()
    mock_appkit.NSWorkspace.sharedWorkspace.return_value = mock_ws

    with patch.dict("sys.modules", {"AppKit": mock_appkit}):
        with preserve_user_focus(enabled=True):
            # Simulated operation where background app became frontmost
            pass

        # Verification: front_before had activateWithOptions called
        mock_front_before.activateWithOptions_.assert_called_once()


def test_mac_adapter_smart_click_ax_press():
    """Verify smart_click uses AXPress when matching interactive element exists."""
    mock_mac = MagicMock()
    mock_mac.ax.query.return_value = [
        {"element_index": 4, "title": "Post", "actions": ["AXPress"]}
    ]
    adapter = MacAdapter(mac=mock_mac)

    res = adapter.smart_click(target_text="Post", app="Twitter")
    assert res["status"] == "ok"
    assert res["method"] == "ax_press"
    assert res["element_index"] == 4
    assert res["background_isolated"] is True
    mock_mac.perform_action.assert_called_once_with(4, action="AXPress")
    mock_mac.click.assert_not_called()


def test_skills_adapter_spotify_applescript_fallback():
    """Verify SkillsAdapter falls back to native AppleScript for Spotify when CLI is absent."""
    with patch("shutil.which", return_value=None):
        adapter = SkillsAdapter()
        with patch.object(adapter, "_run_applescript") as mock_as:
            mock_as.return_value = {"status": "ok", "output": "Playing: Song by Artist"}
            res = adapter.spotify("play")
            assert res["status"] == "ok"
            mock_as.assert_called_once_with('tell application "Spotify" to play')

            res_status = adapter.spotify("status")
            assert res_status["status"] == "ok"


def test_skills_adapter_apple_music():
    """Verify SkillsAdapter controls Apple Music silently via AppleScript."""
    adapter = SkillsAdapter()
    with patch.object(adapter, "_run_applescript") as mock_as:
        mock_as.return_value = {"status": "ok", "output": "Playing"}
        res = adapter.music("play")
        assert res["status"] == "ok"
        mock_as.assert_called_once_with('tell application "Music" to play')


def test_loco_adapter_headless_and_background():
    """Verify LocoAdapter setup_chrome passes headless flag when requested."""
    adapter = LocoAdapter()
    with patch.object(adapter, "_run_bun") as mock_run:
        mock_run.return_value = {"exit_code": 0, "stdout": "ok", "stderr": ""}
        with patch.object(adapter, "is_cdp_up", return_value=True):
            res = adapter.setup_chrome(target="x", headless=True)
            assert res["status"] == "ok"
            assert res["background_isolated"] is True
            # Verify --headless was passed
            called_args = mock_run.call_args[0][0]
            assert "--headless" in called_args


def test_desktop_focus_restoration():
    """Verify Desktop captures and restores frontmost application around send."""
    cfg = MagicMock()
    cfg.restore_focus = True
    desktop = Desktop(cfg)

    mock_front = MagicMock()
    mock_front.processIdentifier.return_value = 500

    mock_cur = MagicMock()
    mock_cur.processIdentifier.return_value = 999

    mock_ws = MagicMock()
    mock_ws.frontmostApplication.return_value = mock_cur

    mock_appkit = MagicMock()
    mock_appkit.NSWorkspace.sharedWorkspace.return_value = mock_ws

    with patch.dict("sys.modules", {"AppKit": mock_appkit}):
        desktop._restore_frontmost(mock_front)
        mock_front.activateWithOptions_.assert_called_once()
