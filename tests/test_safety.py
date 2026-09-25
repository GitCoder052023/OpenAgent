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
