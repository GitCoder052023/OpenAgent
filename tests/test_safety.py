import pytest
from unittest.mock import MagicMock, patch
from OpenAgent.ax import verify_header
from OpenAgent.desktop import Desktop
from OpenAgent.config import Config
from OpenAgent.replies import incoming

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


from OpenAgent.replies import voice_groups, watch

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
    from OpenAgent import ax
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
    from OpenAgent.main import is_hotkey
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
    from OpenAgent.ax import verify_header
    rows = [{"path": "/0/1", "role": "AXButton", "title": "", "value": "", "description": "Instinct"}]
    # In unlocked mode, if header contains "Instinct", it passes without warning spam
    assert verify_header(rows, "+16508702892", "/0/1", safe_mode=False)


def test_audioop_fallback_rms():
    from OpenAgent.voice import audioop
    dummy = b"\x00\x01" * 1000
    assert audioop.rms(dummy, 2) == 256
    assert audioop.rms(b"", 2) == 0


def test_voice_state_wake_and_sleep():
    from OpenAgent.voice import VoiceState
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


def test_click_element_by_description_popover_vs_menubar(monkeypatch):
    from OpenAgent import ax
    mock_rows = [
        # Menubar item that matches "file"
        {"path": "/1/4/0/17/0/1", "role": "AXMenuItem", "title": "\u200eSend file...", "value": "", "description": ""},
        # Window popover button
        {"path": "/0/4/0/0/0/0", "role": "AXButton", "title": "", "value": "", "description": "\u200eFile"},
    ]
    monkeypatch.setattr(ax, "snapshot", lambda safe_mode=False: mock_rows)
    monkeypatch.setattr(ax, "get_whatsapp_pid", lambda: 99999)

    clicked = []
    def mock_perform_action(el, action):
        clicked.append((el, action))
        return 0

    monkeypatch.setattr("ApplicationServices.AXUIElementCreateApplication", lambda pid: "root")
    def mock_copy_attr(el, attr, val):
        if attr == "AXChildren":
            # return mock child based on indexes
            return (0, ["c0", "c1", "c2", "c3", "c4", "c5"])
        return (0, None)
    monkeypatch.setattr("ApplicationServices.AXUIElementCopyAttributeValue", mock_copy_attr)
    monkeypatch.setattr("ApplicationServices.AXUIElementPerformAction", mock_perform_action)

    # Searching for "File" should pick the popover button in /0/, NOT the menubar item in /1/
    res = ax.click_element_by_description("File")
    assert res is True
    assert len(clicked) == 1
    assert clicked[0][1] == "AXPress"


def test_desktop_send_file_clipboard_direct(monkeypatch, tmp_path):
    from OpenAgent.desktop import Desktop
    from OpenAgent.config import Config

    test_file = tmp_path / "test.png"
    test_file.write_bytes(b"PNGDATA" * 10)

    cfg = Config(
        number="+16508702892",
        safe_mode=False,
        attach_label="Share media",
        document_label="File",
        attachment_send_label="Send",
    )
    desk = Desktop(cfg)

    events_recorded = []
    monkeypatch.setattr("OpenAgent.desktop.event", lambda name, **kw: events_recorded.append((name, kw)))
    monkeypatch.setattr(desk, "assert_locked", lambda quick=True: True)
    monkeypatch.setattr("OpenAgent.desktop.activate_whatsapp", lambda: True)
    monkeypatch.setattr("OpenAgent.desktop.ensure_whatsapp_ready", lambda num, hide_after=False: True)
    monkeypatch.setattr("OpenAgent.desktop.hide_whatsapp", lambda: True)
    monkeypatch.setattr(desk, "_stage_clipboard", lambda path: True)
    monkeypatch.setattr("OpenAgent.desktop.focus_composer", lambda: True)

    subproc_calls = []
    monkeypatch.setattr("subprocess.run", lambda cmd, **kw: subproc_calls.append(cmd) or True)
    monkeypatch.setattr("OpenAgent.desktop.click_preview_send", lambda timeout=4.0: True)

    assert desk.send_file(test_file) is True
    # Verify no filepicker attach.scpt was executed
    assert not any("attach.scpt" in str(c) for c in subproc_calls)
    steps = [kw["step"] for name, kw in events_recorded if name == "picker_step"]
    assert "dispatch" in steps


def test_desktop_send_file_picker_fallback(monkeypatch, tmp_path):
    from OpenAgent.desktop import Desktop
    from OpenAgent.config import Config

    test_file = tmp_path / "test.png"
    test_file.write_bytes(b"PNGDATA" * 10)

    cfg = Config(
        number="+16508702892",
        safe_mode=False,
        attach_label="Share media",
        document_label="File",
        attachment_send_label="Send",
    )
    desk = Desktop(cfg)

    events_recorded = []
    monkeypatch.setattr("OpenAgent.desktop.event", lambda name, **kw: events_recorded.append((name, kw)))
    monkeypatch.setattr(desk, "assert_locked", lambda quick=True: True)
    monkeypatch.setattr("OpenAgent.desktop.activate_whatsapp", lambda: True)
    monkeypatch.setattr("OpenAgent.desktop.ensure_whatsapp_ready", lambda num, hide_after=False: True)
    monkeypatch.setattr("OpenAgent.desktop.hide_whatsapp", lambda: True)
    # Simulate clipboard failure so it takes fallback
    monkeypatch.setattr(desk, "_send_file_clipboard", lambda path: False)

    clicked = []
    monkeypatch.setattr("OpenAgent.desktop.click_element_by_description", lambda label, **kw: clicked.append(label) or True)

    subproc_calls = []
    monkeypatch.setattr("subprocess.run", lambda cmd, **kw: subproc_calls.append(cmd) or True)
    monkeypatch.setattr("OpenAgent.desktop.click_preview_send", lambda timeout=5.0: True)

    assert desk.send_file(test_file) is True
    assert "Share media" in clicked
    assert "File" in clicked
    assert any("attach.scpt" in str(c) for call in subproc_calls for c in call)
    steps = [kw["step"] for name, kw in events_recorded if name == "picker_step"]
    assert "attach" in steps
    assert "document" in steps
    assert "chooser" in steps
    assert "dispatch" in steps


def test_verify_header_rejects_unrelated_chat_unlocked():
    """Unrelated chat header (e.g. 'Unrelated Contact') must return False in unlocked mode."""
    rows = [{"path": "/0/1", "role": "AXButton", "title": "", "value": "", "description": "Unrelated Contact"}]
    # Must NOT verify as valid for the bridge phone number
    assert verify_header(rows, "+16508702892", "/0/1", safe_mode=False) is False


def test_verify_header_rejects_unrelated_chat_safe_mode():
    """Unrelated chat header must raise RuntimeError in safe mode."""
    rows = [{"path": "/0/1", "role": "AXButton", "title": "", "value": "", "description": "Unrelated Contact"}]
    with pytest.raises(RuntimeError, match="Selected chat number/path mismatch"):
        verify_header(rows, "+16508702892", "/0/1", safe_mode=True)


def test_desktop_is_locked_and_assert_locked(monkeypatch):
    """is_locked() returns True only when active chat matches target; assert_locked() raises otherwise."""
    cfg = Config(number="+16508702892", header_path="/0/1", safe_mode=False)
    desk = Desktop(cfg)

    # When header is unrelated chat
    wrong_rows = [{"path": "/0/1", "role": "AXButton", "title": "Unrelated Contact", "value": "", "description": ""}]
    monkeypatch.setattr("OpenAgent.desktop.snapshot", lambda safe_mode=False: wrong_rows)
    assert desk.is_locked() is False
    with pytest.raises(RuntimeError, match="Selected chat number/path mismatch"):
        desk.assert_locked(quick=True)

    # When header is Instinct
    correct_rows = [{"path": "/0/1", "role": "AXButton", "title": "Instinct", "value": "", "description": ""}]
    monkeypatch.setattr("OpenAgent.desktop.snapshot", lambda safe_mode=False: correct_rows)
    assert desk.is_locked() is True
    assert desk.assert_locked(quick=True) is True


def test_desktop_send_tool_response_auto_switches_to_bridge_chat(monkeypatch):
    """If another chat is active, send_tool_response must switch back to bridge chat before sending."""
    cfg = Config(number="+16508702892", header_path="/0/1", safe_mode=False)
    desk = Desktop(cfg)

    active_chat = ["Unrelated Contact"]

    def mock_snapshot(safe_mode=False):
        return [{"path": "/0/1", "role": "AXButton", "title": active_chat[0], "value": "", "description": ""}]

    def mock_ensure_ready(num, hide_after=False):
        # Simulate switching back to Instinct
        active_chat[0] = "Instinct"
        return True

    commands_executed = []
    def mock_subproc_run(cmd, **kwargs):
        commands_executed.append(cmd)
        return True

    monkeypatch.setattr("OpenAgent.desktop.snapshot", mock_snapshot)
    monkeypatch.setattr("OpenAgent.desktop.activate_whatsapp", lambda: True)
    monkeypatch.setattr("OpenAgent.desktop.hide_whatsapp", lambda: True)
    monkeypatch.setattr("OpenAgent.desktop.focus_composer", lambda: True)
    monkeypatch.setattr("OpenAgent.desktop.ensure_whatsapp_ready", mock_ensure_ready)
    monkeypatch.setattr("subprocess.run", mock_subproc_run)

    desk.send_tool_response("[Jarvis Tool Response: test output]")

    assert active_chat[0] == "Instinct"
    assert any("send.scpt" in str(cmd) for cmd in commands_executed)
    assert any("commit.scpt" in str(cmd) for cmd in commands_executed)


def test_desktop_send_tool_response_fails_closed_if_chat_not_restored(monkeypatch):
    """If switching back to bridge chat fails, send_tool_response must fail closed and refuse to send."""
    cfg = Config(number="+16508702892", header_path="/0/1", safe_mode=False)
    desk = Desktop(cfg)

    # WhatsApp stays stuck on unrelated chat
    wrong_rows = [{"path": "/0/1", "role": "AXButton", "title": "Unrelated Contact", "value": "", "description": ""}]
    monkeypatch.setattr("OpenAgent.desktop.snapshot", lambda safe_mode=False: wrong_rows)
    monkeypatch.setattr("OpenAgent.desktop.activate_whatsapp", lambda: True)
    monkeypatch.setattr("OpenAgent.desktop.hide_whatsapp", lambda: True)
    monkeypatch.setattr("OpenAgent.desktop.focus_composer", lambda: True)
    monkeypatch.setattr("OpenAgent.desktop.ensure_whatsapp_ready", lambda num, hide_after=False: False)

    commands_executed = []
    monkeypatch.setattr("subprocess.run", lambda cmd, **kwargs: commands_executed.append(cmd))

    with pytest.raises(RuntimeError, match="Selected chat number/path mismatch"):
        desk.send_tool_response("[Jarvis Tool Response: secret data]")

    # Crucial safety assertion: osascript send.scpt / commit.scpt was NEVER called
    assert len(commands_executed) == 0


def test_desktop_send_fails_closed_if_chat_not_restored(monkeypatch):
    """If switching back to bridge chat fails, desktop.send must fail closed and refuse to send."""
    cfg = Config(number="+16508702892", header_path="/0/1", safe_mode=False)
    desk = Desktop(cfg)

    wrong_rows = [{"path": "/0/1", "role": "AXButton", "title": "Unrelated Contact", "value": "", "description": ""}]
    monkeypatch.setattr("OpenAgent.desktop.snapshot", lambda safe_mode=False: wrong_rows)
    monkeypatch.setattr("OpenAgent.desktop.activate_whatsapp", lambda: True)
    monkeypatch.setattr("OpenAgent.desktop.hide_whatsapp", lambda: True)
    monkeypatch.setattr("OpenAgent.desktop.focus_composer", lambda: True)
    monkeypatch.setattr("OpenAgent.desktop.ensure_whatsapp_ready", lambda num, hide_after=False: False)

    commands_executed = []
    monkeypatch.setattr("subprocess.run", lambda cmd, **kwargs: commands_executed.append(cmd))

    with pytest.raises(RuntimeError, match="Selected chat number/path mismatch"):
        desk.send("Hello world")

    assert len(commands_executed) == 0


def test_watch_inbound_isolation_rejects_unrelated_chat():
    """watch() must raise RuntimeError on unrelated chat even in unlocked mode."""
    from OpenAgent.replies import watch
    cfg = Config(number="+16508702892", header_path="/0/1", safe_mode=False)
    wrong_rows = [{"path": "/0/1", "role": "AXButton", "title": "Unrelated Contact", "value": "", "description": ""}]

    with pytest.raises(RuntimeError, match="Selected chat number/path mismatch"):
        watch(cfg, timeout=0.1, get_snapshot=lambda safe_mode=False: wrong_rows)



def test_macos_disambiguation_whatsapp(monkeypatch):
    """Ensure MacOS._resolve_app('WhatsApp') chooses main app over helper extensions."""
    from macos_harness.macos import MacOS
    macos = MacOS()

    # Mock running applications including Unicode character in WhatsApp name and helper extensions
    mock_app_main = MagicMock()
    mock_app_helper = MagicMock()
    mock_app_autofill = MagicMock()

    app_infos = {
        mock_app_main: {
            "pid": 47893,
            "name": "\u200eWhatsApp",
            "bundle_id": "net.whatsapp.WhatsApp",
            "path": "/Applications/WhatsApp.app/Contents/MacOS/WhatsApp",
        },
        mock_app_helper: {
            "pid": 96023,
            "name": "ServiceExtension",
            "bundle_id": "net.whatsapp.WhatsApp.ServiceExtension",
            "path": "/Applications/WhatsApp.app/Contents/PlugIns/ServiceExtension.appex/Contents/MacOS/ServiceExtension",
        },
        mock_app_autofill: {
            "pid": 47896,
            "name": "AutoFill",
            "bundle_id": "net.whatsapp.WhatsApp.AutoFill",
            "path": "/Applications/WhatsApp.app/Contents/PlugIns/AutoFill.appex/Contents/MacOS/AutoFill",
        },
    }

    mock_ws = MagicMock()
    mock_ws.sharedWorkspace.return_value.runningApplications.return_value = [
        mock_app_helper,
        mock_app_autofill,
        mock_app_main,
    ]
    monkeypatch.setattr("macos_harness.macos.NSWorkspace", mock_ws)
    monkeypatch.setattr(macos, "_app_info", lambda a: app_infos[a])

    app, info = macos._resolve_app("WhatsApp")
    assert app == mock_app_main
    assert info["pid"] == 47893

