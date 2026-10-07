"""Unit tests for the OpenAgent immersive terminal sound engine."""

import os
import time
from unittest.mock import MagicMock, patch
import pytest

from OpenAgent.config import Config
from OpenAgent.sound import (
    SoundEngine,
    SoundEvent,
    _EVENT_DEBOUNCE_SECS,
    _EVENT_VOLUME_SCALE,
    _SOUND_MAP,
    get_engine,
    get_volume,
    is_enabled,
    play,
    set_enabled,
    set_volume,
)


def test_sound_events_completeness():
    """Verify all expected events are defined in SoundEvent enum."""
    expected = {
        "tool_intercept",
        "tool_start",
        "tool_success",
        "tool_error",
        "response_sent",
        "attachment_sent",
        "voice_note_detected",
        "voice_playback_start",
        "voice_playback_finished",
        "chat_message_detected",
        "message_sent",
        "recording_start",
        "recording_stop",
        "voice_wake",
        "voice_sleep",
        "mic_mute",
        "mic_unmute",
        "log_event",
        "boot",
    }
    actual = {e.value for e in SoundEvent}
    assert expected.issubset(actual)


def test_sound_map_coverage():
    """Verify every event in SoundEvent has configured audio candidate paths."""
    for event in SoundEvent:
        assert event in _SOUND_MAP
        assert len(_SOUND_MAP[event]) > 0
        assert event in _EVENT_VOLUME_SCALE


def test_engine_init_and_properties():
    """Test SoundEngine initialization, getters, and setters."""
    engine = SoundEngine(enabled=True, volume=0.5)
    assert engine.enabled is True
    assert engine.volume == 0.5

    engine.enabled = False
    assert engine.enabled is False

    engine.volume = 1.5  # Clamped to 1.0
    assert engine.volume == 1.0

    engine.volume = -0.2  # Clamped to 0.0
    assert engine.volume == 0.0


def test_global_helpers():
    """Test global helper functions for sound engine."""
    set_enabled(True)
    assert is_enabled() is True
    set_volume(0.7)
    assert get_volume() == 0.7

    engine = get_engine()
    assert engine is not None


def test_sound_path_resolution():
    """Test that candidate sound paths resolve correctly."""
    engine = SoundEngine(enabled=True)
    for event in SoundEvent:
        path = engine.get_sound_path(event)
        # On macOS, these files exist
        if path is not None:
            assert os.path.isfile(path)


def test_pytest_auto_mute():
    """Test that playback is suppressed when PYTEST_CURRENT_TEST is set and force flag is not."""
    engine = SoundEngine(enabled=True)
    # PYTEST_CURRENT_TEST is naturally present in pytest
    assert "PYTEST_CURRENT_TEST" in os.environ
    if "OPENAGENT_FORCE_SOUND" in os.environ:
        del os.environ["OPENAGENT_FORCE_SOUND"]

    with patch("subprocess.run") as mock_sub:
        res = engine.play(SoundEvent.TOOL_SUCCESS)
        assert res is False
        mock_sub.assert_not_called()


def test_play_dispatch_when_forced():
    """Test that playback dispatches subprocess when force flag is set."""
    engine = SoundEngine(enabled=True, volume=0.8)
    with patch.dict(os.environ, {"OPENAGENT_FORCE_SOUND": "1"}), patch("subprocess.run") as mock_sub:
        res = engine.play(SoundEvent.TOOL_INTERCEPT)
        assert res is True
        # Allow daemon thread a moment to run
        time.sleep(0.1)
        mock_sub.assert_called_once()
        call_args = mock_sub.call_args[0][0]
        assert call_args[0] == engine._player_bin
        assert call_args[1] == "-v"
        assert float(call_args[2]) > 0.0
        assert os.path.isfile(call_args[3])


def test_disabled_engine_returns_false():
    """Test that disabled engine does not play sounds."""
    engine = SoundEngine(enabled=False)
    with patch.dict(os.environ, {"OPENAGENT_FORCE_SOUND": "1"}), patch("subprocess.run") as mock_sub:
        res = engine.play(SoundEvent.TOOL_SUCCESS)
        assert res is False
        mock_sub.assert_not_called()


def test_debouncing():
    """Test that repetitive calls for debounced events (like log_event) are throttled."""
    engine = SoundEngine(enabled=True)
    with patch.dict(os.environ, {"OPENAGENT_FORCE_SOUND": "1"}), patch("subprocess.run"):
        # First call should succeed
        res1 = engine.play(SoundEvent.LOG_EVENT)
        assert res1 is True

        # Immediate second call should be debounced
        res2 = engine.play(SoundEvent.LOG_EVENT)
        assert res2 is False


def test_config_sound_fields():
    """Test Config model holds sound_enabled and sound_volume."""
    cfg = Config(sound_enabled=True, sound_volume=0.6)
    assert cfg.sound_enabled is True
    assert cfg.sound_volume == 0.6


def test_config_from_env_sound():
    """Test Config.from_env parses sound environment variables."""
    with patch.dict(os.environ, {"OPENAGENT_SOUNDS_ENABLED": "false", "OPENAGENT_SOUNDS_VOLUME": "0.4"}):
        cfg = Config.from_env()
        assert cfg.sound_enabled is False
        assert cfg.sound_volume == 0.4


def test_is_f5_key_detection():
    """Test F5 key detection across pynput Key.f5 and virtual key codes."""
    from pynput import keyboard
    from OpenAgent.main import is_f5

    assert is_f5(keyboard.Key.f5) is True

    # Virtual key code 96 (macOS F5)
    mock_key_vk = MagicMock()
    mock_key_vk.vk = 96
    mock_key_vk.name = "f5"
    assert is_f5(mock_key_vk) is True

    # Other keys should return False
    assert is_f5(keyboard.Key.f6) is False
    assert is_f5(keyboard.Key.esc) is False


def test_mic_mute_and_unmute_sounds():
    """Test mic_mute and mic_unmute event playback dispatch."""
    engine = SoundEngine(enabled=True)
    with patch.dict(os.environ, {"OPENAGENT_FORCE_SOUND": "1"}), patch("subprocess.run") as mock_sub:
        assert engine.play(SoundEvent.MIC_MUTE) is True
        assert engine.play(SoundEvent.MIC_UNMUTE) is True
