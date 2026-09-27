import pytest
from bridge.ax import verify_header
from bridge.desktop import Desktop
from bridge.config import Config
from bridge.replies import incoming

def test_header_requires_exact_path_and_number():
    rows=[{"path":"/0/1","role":"AXStaticText","title":"+1 (650) 870-2892","value":"","description":""}]
    assert verify_header(rows, "+16508702892", "/0/1")
    with pytest.raises(RuntimeError): verify_header(rows, "+16507096252", "/0/1")
    with pytest.raises(RuntimeError): verify_header(rows, "+16508702892", "/0/2")

def test_requires_calibration():
    with pytest.raises(RuntimeError): verify_header([], "+16508702892", "")
    with pytest.raises(RuntimeError): incoming([], "", "")

def test_reply_only_from_marked_group():
    rows=[
      {"path":"/0/2","role":"AXList","title":"","description":"","value":""},
      {"path":"/0/2/0","role":"AXGroup","title":"Incoming message","description":"","value":""},
      {"path":"/0/2/0/0","role":"AXStaticText","title":"","description":"","value":"Hello"},
      {"path":"/0/2/1","role":"AXGroup","title":"Outgoing message","description":"","value":""},
      {"path":"/0/2/1/0","role":"AXStaticText","title":"","description":"","value":"Secret"},
    ]
    assert incoming(rows,"/0/2","Incoming message") == [("/0/2/0", "Hello")]

def test_send_rejects_multiline():
    with pytest.raises(ValueError): Desktop(Config()).send("hello\nworld")


from bridge.replies import voice_groups, watch

def voice_fixture():
    return [
        {"path":"/0/2","role":"AXList","title":"","description":"","value":""},
        {"path":"/0/2/0","role":"AXGroup","title":"Incoming message","description":"","value":""},
        {"path":"/0/2/0/0","role":"AXStaticText","title":"","description":"","value":"A link https://example.com"},
        {"path":"/0/2/1","role":"AXGroup","title":"Outgoing message","description":"","value":""},
        {"path":"/0/2/1/0","role":"AXButton","title":"Play voice message","description":"","value":""},
        {"path":"/0/2/2","role":"AXGroup","title":"Incoming message","description":"","value":""},
        {"path":"/0/2/2/0","role":"AXButton","title":"Play voice message","description":"","value":""},
    ]

def test_voice_only_inbound_and_silent_text():
    cfg = Config(message_list_path="/0/2", incoming_marker="Incoming message",
                 voice_play_marker="Play voice message", voice_pause_marker="Pause voice message")
    assert voice_groups(voice_fixture(), cfg) == [("/0/2/2", "/0/2/2/0")]

def test_ambiguous_control_refused():
    cfg = Config(message_list_path="/0/2", incoming_marker="Incoming message",
                 voice_play_marker="Play voice message", voice_pause_marker="Pause voice message")
    rows = voice_fixture()
    rows.append({"path":"/0/2/2/1","role":"AXButton","title":"Play voice message","description":"","value":""})
    with pytest.raises(RuntimeError, match="ambiguous"):
        voice_groups(rows, cfg)

def test_uncalibrated_voice_refused():
    with pytest.raises(RuntimeError, match="calibrated"):
        voice_groups(voice_fixture(), Config(message_list_path="/0/2", incoming_marker="Incoming message"))

def test_audio_requires_calibrated_ui(tmp_path):
    wav = tmp_path / "test.m4a"
    wav.write_bytes(b"RIFF" + b"\x00" * 5000)
    with pytest.raises(RuntimeError, match="not calibrated"):
        Desktop(Config(header_path="/0/1")).send_audio(wav)

def test_audio_rejects_wrong_file(tmp_path):
    path = tmp_path / "text.txt"
    path.write_bytes(b"x" * 5000)
    with pytest.raises(ValueError):
        Desktop(Config()).send_audio(path)


def test_unlocked_mode_dynamic_header():
    rows = [{"path": "/0/9", "role": "AXStaticText", "title": "+1 (650) 870-2892", "value": "", "description": ""}]
    assert verify_header(rows, "+16508702892", "", safe_mode=False)


def test_unlocked_mode_from_env(monkeypatch):
    monkeypatch.setenv("BRIDGE_SAFE_MODE", "false")
    monkeypatch.setenv("BRIDGE_SEND_MODE", "text")
    cfg = Config.from_env()
    assert cfg.safe_mode is False
    assert cfg.send_mode == "text"


def test_snapshot_auto_open_mock(monkeypatch):
    from bridge import ax
    monkeypatch.setattr(ax, "get_whatsapp_pid", lambda: None)
    launched = []
    monkeypatch.setattr(ax, "launch_whatsapp", lambda hide=True: launched.append(True) or 12345)
    # Mock AX elements so snapshot returns []
    monkeypatch.setattr(ax, "sys", type("MockSys", (), {"platform": "darwin"}))
    from ApplicationServices import AXUIElementCreateApplication
    monkeypatch.setattr("ApplicationServices.AXUIElementCreateApplication", lambda pid: None)
    monkeypatch.setattr("ApplicationServices.AXUIElementCopyAttributeValue", lambda el, attr, val: (0, []))
    rows = ax.snapshot(safe_mode=True, auto_open=True)
    assert launched == [True]
    assert len(rows) == 1 and rows[0]["path"] == ""


def test_is_hotkey_supports_f8_and_digit_8():
    from pynput import keyboard
    from bridge.main import is_hotkey
    # Test F8 Key
    assert is_hotkey(keyboard.Key.f8, "f8")
    assert is_hotkey(keyboard.Key.media_play_pause, "f8")
    # Test Digit 8 char and keycode
    assert is_hotkey(keyboard.KeyCode.from_char("8"), "f8")
    assert is_hotkey(keyboard.KeyCode.from_vk(100), "f8")
    assert is_hotkey(keyboard.KeyCode.from_vk(28), "f8")
    # Test when name is "8"
    assert is_hotkey(keyboard.KeyCode.from_char("8"), "8")
    assert is_hotkey(keyboard.Key.f8, "8")
    # Test right_shift
    assert is_hotkey(keyboard.Key.shift_r, "right_shift")


def test_verify_header_relaxed_instinct():
    from bridge.ax import verify_header
    rows = [{"path": "/0/1", "role": "AXButton", "title": "", "value": "", "description": "Instinct"}]
    # In unlocked mode, if header contains "Instinct", it passes without warning spam
    assert verify_header(rows, "+16508702892", "/0/1", safe_mode=False)


def test_audioop_fallback_rms():
    from bridge.voice import audioop
    dummy = b"\x00\x01" * 1000
    assert audioop.rms(dummy, 2) == 256
    assert audioop.rms(b"", 2) == 0


def test_voice_state_wake_and_sleep():
    from bridge.voice import VoiceState
    vs = VoiceState()
    assert not vs.awake
    assert vs.accept("hello world") == "ignore"
    assert not vs.awake

    # Wake with standard phrase
    assert vs.accept("Wakeup Jarvis!") == "wake"
    assert vs.awake

    # Normal speech while awake
    assert vs.accept("check the git status please") == "send"

    # Sleep request
    assert vs.accept("jarvis stand by") == "sleep_prompt"
    assert vs.accept("confirm stand by jarvis") == "sleep"
    assert not vs.awake

    # Wake with phonetic match
    assert vs.accept("wake up service") == "wake"
    assert vs.awake


