import pytest
import threading
import time
from unittest.mock import MagicMock
from OpenAgent.config import Config
from OpenAgent.replies import incoming_texts, watch
from OpenAgent.desktop import Desktop
from OpenAgent.harness import Harness


def test_incoming_texts_filters_outgoing():
    cfg = Config(
        number="+16508702892",
        message_list_path="/0/2",
        incoming_marker="Incoming message",
    )
    rows = [
        {"path": "/0/2", "role": "AXList", "title": "", "description": "", "value": ""},
        # Incoming tool call
        {"path": "/0/2/0", "role": "AXGroup", "title": "Incoming message", "description": "", "value": ""},
        {"path": "/0/2/0/0", "role": "AXStaticText", "title": "", "description": "", "value": '```json\n{"tool": "bash", "args": {"command": "ls"}}\n```'},
        # Outgoing message
        {"path": "/0/2/1", "role": "AXGroup", "title": "Outgoing message", "description": "", "value": ""},
        {"path": "/0/2/1/0", "role": "AXStaticText", "title": "", "description": "", "value": "echo hello"},
        # Outgoing tool response
        {"path": "/0/2/2", "role": "AXGroup", "title": "Incoming message", "description": "", "value": ""},
        {"path": "/0/2/2/0", "role": "AXStaticText", "title": "", "description": "", "value": "[Jarvis Tool Response: bash | status: ok]\n(exit 0)"},
    ]

    texts = incoming_texts(rows, cfg)
    assert len(texts) == 1
    grp_path, msg_text, sig = texts[0]
    assert grp_path == "/0/2/0"
    assert "bash" in msg_text
    assert sig.startswith("txt:")


def test_incoming_texts_requires_list_path():
    cfg = Config(message_list_path="")
    assert incoming_texts([], cfg) == []


def test_watch_baselines_existing_tool_calls():
    cfg = Config(
        number="+16508702892",
        header_path="/0/1",
        message_list_path="/0/2",
        incoming_marker="Incoming message",
        ledger_path=":memory:",
    )
    initial_rows = [
        {"path": "/0/1", "role": "AXStaticText", "title": "+1 (650) 870-2892", "description": "", "value": ""},
        {"path": "/0/2", "role": "AXList", "title": "", "description": "", "value": ""},
        {"path": "/0/2/0", "role": "AXGroup", "title": "Incoming message", "description": "", "value": ""},
        {"path": "/0/2/0/0", "role": "AXStaticText", "title": "", "description": "", "value": '{"tool": "bash", "args": {"command": "git log"}}'},
    ]

    mock_desk = MagicMock(spec=Desktop)
    mock_harness = MagicMock(spec=Harness)
    stop = threading.Event()
    stop.set()  # Stop immediately after initialization

    state = {}
    watch(
        cfg,
        stop=stop,
        get_snapshot=lambda **kw: initial_rows,
        state=state,
        desk=mock_desk,
        harness=mock_harness,
    )

    # Baselined messages should be marked as processed
    assert len(state["processed_texts"]) == 1
    # Harness must NOT have been called on historical messages
    mock_harness.bash.assert_not_called()
    mock_desk.send_tool_response.assert_not_called()


def test_watch_dispatches_new_tool_call_and_deduplicates():
    cfg = Config(
        number="+16508702892",
        header_path="/0/1",
        message_list_path="/0/2",
        incoming_marker="Incoming message",
    )

    base_rows = [
        {"path": "/0/1", "role": "AXStaticText", "title": "+1 (650) 870-2892", "description": "", "value": ""},
        {"path": "/0/2", "role": "AXList", "title": "", "description": "", "value": ""},
    ]

    new_rows = base_rows + [
        {"path": "/0/2/0", "role": "AXGroup", "title": "Incoming message", "description": "", "value": ""},
        {"path": "/0/2/0/0", "role": "AXStaticText", "title": "", "description": "", "value": '```json\n{"tool": "bash", "args": {"command": "uptime"}}\n```'},
    ]

    mock_desk = MagicMock(spec=Desktop)
    mock_harness = MagicMock(spec=Harness)
    mock_harness.bash.return_value = {"exit_code": 0, "output": "up 2 days", "timed_out": False}

    state = {"processed_texts": set()}
    stop = threading.Event()

    ticks = [0]
    def snapshot_provider(**kw):
        ticks[0] += 1
        if ticks[0] >= 2:
            stop.set()
        return new_rows

    watch(
        cfg,
        timeout=2,
        stop=stop,
        get_snapshot=snapshot_provider,
        state=state,
        desk=mock_desk,
        harness=mock_harness,
    )

    # Harness should have been invoked exactly once
    assert mock_harness.bash.call_count == 1
    mock_harness.bash.assert_called_once_with(command="uptime", cwd=None, timeout_ms=60000)

    # Response sent to WhatsApp exactly once
    assert mock_desk.send_tool_response.call_count == 1
    sent_text = mock_desk.send_tool_response.call_args[0][0]
    assert "[Jarvis Tool Response: bash | status: ok]" in sent_text
    assert "up 2 days" in sent_text


def test_body_from_description_incoming_text():
    """Test body extraction from WhatsApp 2.26+ flat AXDescription format."""
    from OpenAgent.replies import _body_from_description

    # Standard incoming text
    desc = "\u200emessage, JARVIS_CALL:eyJ0b29sIjoic3lzdGVtX2luZm8iLCJhcmdzIjp7fX0=:END, 10:50\u202fAM, \u200eReceived from + 1,6 5 0,8 7 0,2 8 9 2"
    body = _body_from_description(desc)
    assert body == "JARVIS_CALL:eyJ0b29sIjoic3lzdGVtX2luZm8iLCJhcmdzIjp7fX0=:END"

    # Outgoing text (should NOT extract)
    desc_out = "\u200eYour message, hello world, 10:52\u202fAM, \u200eSent to + 1,6 5 0,8 7 0,2 8 9 2, \u200eDelivered"
    assert _body_from_description(desc_out) == ""

    # Voice message (should NOT extract)
    desc_voice = "\u200eVoice message, \u200eDuration: 9 seconds, 10:50\u202fAM, \u200eListened"
    assert _body_from_description(desc_voice) == ""

    # Truncated description (no timestamp suffix due to 1500 char limit)
    desc_trunc = "\u200emessage, Some very long message body here..."
    body_trunc = _body_from_description(desc_trunc)
    assert body_trunc == "Some very long message body here..."

    # Empty or unrecognized
    assert _body_from_description("") == ""
    assert _body_from_description("Some random text") == ""


def test_incoming_texts_flat_ax_nodes():
    """WhatsApp 2.26+ renders each message as a flat AXStaticText with body in description."""
    cfg = Config(
        number="+16508702892",
        message_list_path="/0/2",
        incoming_marker="Voice message",
        safe_mode=False,
    )
    rows = [
        {"path": "/0/2", "role": "AXGroup", "title": "", "description": "\u200eMessages in chat", "value": ""},
        # Outgoing audio (flat AXStaticText, no children)
        {"path": "/0/2/0", "role": "AXStaticText", "title": "", "description": "\u200eYour document, file.m4a, 10:49\u202fAM, \u200eSent to + 1,6 5 0,8 7 0,2 8 9 2, \u200eDelivered", "value": ""},
        # Incoming JARVIS_CALL (flat AXStaticText)
        {"path": "/0/2/1", "role": "AXStaticText", "title": "", "description": "\u200emessage, JARVIS_CALL:eyJ0b29sIjoic3lzdGVtX2luZm8iLCJhcmdzIjp7fX0=:END, 10:50\u202fAM, \u200eReceived from + 1,6 5 0,8 7 0,2 8 9 2", "value": ""},
        # Outgoing text (flat AXStaticText)
        {"path": "/0/2/2", "role": "AXStaticText", "title": "", "description": "\u200eYour message, hello world, 10:52\u202fAM, \u200eSent to + 1,6 5 0,8 7 0,2 8 9 2, \u200eDelivered", "value": ""},
        # Incoming voice note
        {"path": "/0/2/3", "role": "AXStaticText", "title": "", "description": "\u200eVoice message, \u200eDuration: 9 seconds, 10:50\u202fAM, \u200eListened", "value": ""},
    ]

    texts = incoming_texts(rows, cfg)
    assert len(texts) == 1
    grp_path, msg_text, sig = texts[0]
    assert grp_path == "/0/2/1"
    assert "JARVIS_CALL:" in msg_text
    assert "system_info" not in msg_text  # Body is the raw envelope, not decoded


def test_watch_dispatches_flat_node_tool_call():
    """End-to-end: watch() picks up a JARVIS_CALL from a flat AXStaticText description."""
    cfg = Config(
        number="+16508702892",
        header_path="/0/1",
        message_list_path="/0/2",
        incoming_marker="Voice message",
        safe_mode=False,
    )

    base_rows = [
        {"path": "/0/1", "role": "AXButton", "title": "", "description": "Instinct", "value": ""},
        {"path": "/0/2", "role": "AXGroup", "title": "", "description": "\u200eMessages in chat", "value": ""},
    ]

    new_rows = base_rows + [
        {"path": "/0/2/0", "role": "AXStaticText", "title": "", "description": "\u200emessage, JARVIS_CALL:eyJ0b29sIjoic3lzdGVtX2luZm8iLCJhcmdzIjp7fX0=:END, 10:50\u202fAM, \u200eReceived from + 1,6 5 0,8 7 0,2 8 9 2", "value": ""},
    ]

    mock_desk = MagicMock(spec=Desktop)
    mock_harness = MagicMock(spec=Harness)
    mock_harness.system_info.return_value = {"os": "macOS", "hostname": "test"}

    state = {"processed_texts": set()}
    stop = threading.Event()

    ticks = [0]
    def snapshot_provider(**kw):
        ticks[0] += 1
        if ticks[0] >= 2:
            stop.set()
        return new_rows

    watch(
        cfg,
        timeout=2,
        stop=stop,
        get_snapshot=snapshot_provider,
        state=state,
        desk=mock_desk,
        harness=mock_harness,
    )

    # system_info should have been invoked exactly once
    assert mock_harness.system_info.call_count == 1

    # Response sent to WhatsApp exactly once
    assert mock_desk.send_tool_response.call_count == 1
    sent_text = mock_desk.send_tool_response.call_args[0][0]
    assert "[Jarvis Tool Response: system_info | status: ok]" in sent_text


def test_signature_stability_across_path_and_status_changes():
    """Verify that a message moving paths or changing delivery status retains the exact same signature."""
    cfg = Config(
        number="+16508702892",
        message_list_path="/0/2",
        safe_mode=False,
    )

    # Initial state: message at /0/2/1 with "Received from" status
    rows1 = [
        {"path": "/0/2", "role": "AXGroup", "title": "", "description": "\u200eMessages", "value": ""},
        {"path": "/0/2/1", "role": "AXStaticText", "title": "", "description": "\u200emessage, JARVIS_CALL:eyJ0b29sIjoic3lzdGVtX2luZm8iLCJhcmdzIjp7fX0=:END, 10:50\u202fAM, \u200eReceived from + 1,6 5 0,8 7 0,2 8 9 2", "value": ""},
    ]
    texts1 = incoming_texts(rows1, cfg)
    assert len(texts1) == 1
    _, _, sig1 = texts1[0]

    # After audio or response sent: message moves to /0/2/4, status changes to "Read"
    rows2 = [
        {"path": "/0/2", "role": "AXGroup", "title": "", "description": "\u200eMessages", "value": ""},
        {"path": "/0/2/0", "role": "AXStaticText", "title": "", "description": "\u200eYour message, hi, 10:48\u202fAM, \u200eSent to + 1,6 5 0,8 7 0,2 8 9 2, \u200eDelivered", "value": ""},
        {"path": "/0/2/1", "role": "AXStaticText", "title": "", "description": "\u200eYour document, file.m4a, 10:49\u202fAM, \u200eSent to + 1,6 5 0,8 7 0,2 8 9 2, \u200eDelivered", "value": ""},
        {"path": "/0/2/4", "role": "AXStaticText", "title": "", "description": "\u200emessage, JARVIS_CALL:eyJ0b29sIjoic3lzdGVtX2luZm8iLCJhcmdzIjp7fX0=:END, 10:50\u202fAM, \u200eRead", "value": ""},
    ]
    texts2 = incoming_texts(rows2, cfg)
    assert len(texts2) == 1
    _, _, sig2 = texts2[0]

    # The signature must be identical so it is NOT re-executed
    assert sig1 == sig2


def test_identical_text_separate_messages_are_distinct():
    """Verify that two separate incoming messages with identical text are treated as distinct."""
    cfg = Config(
        number="+16508702892",
        message_list_path="/0/2",
        safe_mode=False,
    )

    # Case A: Two messages sent at different times (e.g. 10:40 AM and 10:50 AM)
    rows_diff_time = [
        {"path": "/0/2", "role": "AXGroup", "title": "", "description": "\u200eMessages", "value": ""},
        {"path": "/0/2/0", "role": "AXStaticText", "title": "", "description": "\u200emessage, JARVIS_CALL:eyJ0b29sIjoic3lzdGVtX2luZm8iLCJhcmdzIjp7fX0=:END, 10:40\u202fAM, \u200eReceived from + 1,6 5 0,8 7 0,2 8 9 2", "value": ""},
        {"path": "/0/2/1", "role": "AXStaticText", "title": "", "description": "\u200emessage, JARVIS_CALL:eyJ0b29sIjoic3lzdGVtX2luZm8iLCJhcmdzIjp7fX0=:END, 10:50\u202fAM, \u200eReceived from + 1,6 5 0,8 7 0,2 8 9 2", "value": ""},
    ]
    texts_diff = incoming_texts(rows_diff_time, cfg)
    assert len(texts_diff) == 2
    assert texts_diff[0][2] != texts_diff[1][2], "Messages at different times must have distinct signatures"

    # Case B: Two messages sent at the same minute (e.g. both 10:50 AM)
    rows_same_time = [
        {"path": "/0/2", "role": "AXGroup", "title": "", "description": "\u200eMessages", "value": ""},
        {"path": "/0/2/0", "role": "AXStaticText", "title": "", "description": "\u200emessage, JARVIS_CALL:eyJ0b29sIjoic3lzdGVtX2luZm8iLCJhcmdzIjp7fX0=:END, 10:50\u202fAM, \u200eReceived from + 1,6 5 0,8 7 0,2 8 9 2", "value": ""},
        {"path": "/0/2/1", "role": "AXStaticText", "title": "", "description": "\u200emessage, JARVIS_CALL:eyJ0b29sIjoic3lzdGVtX2luZm8iLCJhcmdzIjp7fX0=:END, 10:50\u202fAM, \u200eReceived from + 1,6 5 0,8 7 0,2 8 9 2", "value": ""},
    ]
    texts_same = incoming_texts(rows_same_time, cfg)
    assert len(texts_same) == 2
    assert texts_same[0][2] != texts_same[1][2], "Two messages at the same minute must have distinct occurrence signatures"
    assert texts_same[0][2].endswith(":0")
    assert texts_same[1][2].endswith(":1")


def test_watch_startup_baseline_never_executes_existing_envelopes(tmp_path):
    """Envelopes already present when the bridge starts must be baselined and never executed."""
    ledger_file = tmp_path / "processed.jsonl"
    cfg = Config(
        number="+16508702892",
        header_path="/0/1",
        message_list_path="/0/2",
        safe_mode=False,
        ledger_path=str(ledger_file),
    )

    rows = [
        {"path": "/0/1", "role": "AXButton", "title": "", "description": "Instinct", "value": ""},
        {"path": "/0/2", "role": "AXGroup", "title": "", "description": "\u200eMessages", "value": ""},
        {"path": "/0/2/0", "role": "AXStaticText", "title": "", "description": "\u200emessage, JARVIS_CALL:eyJ0b29sIjoic3lzdGVtX2luZm8iLCJhcmdzIjp7fX0=:END, 10:40\u202fAM, \u200eReceived from + 1,6 5 0,8 7 0,2 8 9 2", "value": ""},
        {"path": "/0/2/1", "role": "AXStaticText", "title": "", "description": "\u200emessage, JARVIS_CALL:eyJ0b29sIjoic3lzdGVtX2luZm8iLCJhcmdzIjp7fX0=:END, 10:50\u202fAM, \u200eReceived from + 1,6 5 0,8 7 0,2 8 9 2", "value": ""},
    ]

    mock_desk = MagicMock(spec=Desktop)
    mock_harness = MagicMock(spec=Harness)

    state = {}
    stop = threading.Event()

    ticks = [0]
    def snapshot_provider(**kw):
        ticks[0] += 1
        if ticks[0] >= 3:
            stop.set()
        return rows

    watch(
        cfg,
        timeout=2,
        stop=stop,
        get_snapshot=snapshot_provider,
        state=state,
        desk=mock_desk,
        harness=mock_harness,
    )

    # Neither existing message should have run
    mock_harness.system_info.assert_not_called()
    mock_desk.send_tool_response.assert_not_called()
    # Both should be in processed_texts and in the ledger
    assert len(state["processed_texts"]) == 2
    assert ledger_file.exists()


def test_cross_restart_persistence(tmp_path):
    """Processed tool calls recorded in the ledger must survive across bridge restarts."""
    ledger_file = tmp_path / "processed.jsonl"
    cfg = Config(
        number="+16508702892",
        header_path="/0/1",
        message_list_path="/0/2",
        safe_mode=False,
        ledger_path=str(ledger_file),
    )

    base_rows = [
        {"path": "/0/1", "role": "AXButton", "title": "", "description": "Instinct", "value": ""},
        {"path": "/0/2", "role": "AXGroup", "title": "", "description": "\u200eMessages", "value": ""},
    ]

    msg_a = {"path": "/0/2/0", "role": "AXStaticText", "title": "", "description": "\u200emessage, JARVIS_CALL:eyJ0b29sIjoic3lzdGVtX2luZm8iLCJhcmdzIjp7fX0=:END, 10:40\u202fAM, \u200eReceived from + 1,6 5 0,8 7 0,2 8 9 2", "value": ""}
    msg_b = {"path": "/0/2/1", "role": "AXStaticText", "title": "", "description": "\u200emessage, JARVIS_CALL:eyJ0b29sIjoic3lzdGVtX2luZm8iLCJhcmdzIjp7fX0=:END, 10:50\u202fAM, \u200eReceived from + 1,6 5 0,8 7 0,2 8 9 2", "value": ""}

    # Session 1: Baseline starts with empty chat, then msg_a arrives and runs
    mock_desk1 = MagicMock(spec=Desktop)
    mock_harness1 = MagicMock(spec=Harness)
    mock_harness1.system_info.return_value = {"status": "ok"}
    stop1 = threading.Event()

    ticks1 = [0]
    def snapshot_s1(**kw):
        ticks1[0] += 1
        if ticks1[0] == 1:
            return base_rows
        if ticks1[0] >= 3:
            stop1.set()
        return base_rows + [msg_a]

    watch(
        cfg,
        timeout=2,
        stop=stop1,
        get_snapshot=snapshot_s1,
        state={},
        desk=mock_desk1,
        harness=mock_harness1,
    )

    assert mock_harness1.system_info.call_count == 1
    assert mock_desk1.send_tool_response.call_count == 1

    # Session 2 (bridge restart): fresh state, chat now has msg_a and new msg_b
    mock_desk2 = MagicMock(spec=Desktop)
    mock_harness2 = MagicMock(spec=Harness)
    mock_harness2.system_info.return_value = {"status": "ok"}
    stop2 = threading.Event()

    ticks2 = [0]
    def snapshot_s2(**kw):
        ticks2[0] += 1
        if ticks2[0] >= 3:
            stop2.set()
        return base_rows + [msg_a, msg_b]

    # Fresh state={} simulates new process startup
    watch(
        cfg,
        timeout=2,
        stop=stop2,
        get_snapshot=snapshot_s2,
        state={},
        desk=mock_desk2,
        harness=mock_harness2,
    )

    # msg_a was in the persistent ledger from session 1, and msg_b was present at session 2 startup
    # (so it was baselined). Therefore harness should not run msg_a again!
    assert mock_harness2.system_info.call_count == 0
    assert mock_desk2.send_tool_response.call_count == 0


def test_voice_note_held_while_user_recording_and_played_after():
    """Incoming voice note must be held while user is recording, and played only after user finishes."""
    from OpenAgent.replies import resolve_voice_control

    cfg = Config(
        number="+16508702892",
        header_path="/0/1",
        message_list_path="/0/2",
        incoming_marker="Incoming message",
        voice_play_marker="Play voice message",
        voice_pause_marker="Pause voice message",
        safe_mode=False,
    )

    base_rows = [
        {"path": "/0/1", "role": "AXButton", "title": "+1 (650) 870-2892", "description": "", "value": ""},
        {"path": "/0/2", "role": "AXList", "title": "", "description": "", "value": ""},
    ]

    incoming_rows = base_rows + [
        {"path": "/0/2/0", "role": "AXGroup", "title": "Incoming message", "description": "", "value": ""},
        {"path": "/0/2/0/0", "role": "AXButton", "title": "Play voice message", "description": "0:05", "value": ""},
    ]

    mock_press = MagicMock()
    user_recording = threading.Event()
    user_recording.set()  # User is currently recording voice!
    stop = threading.Event()
    playing = threading.Event()
    state = {}

    ticks = [0]
    def snapshot_provider(**kw):
        ticks[0] += 1
        # Tick 1: Initial baseline (no messages)
        if ticks[0] == 1:
            return base_rows
        # Tick 2: Voice note arrives while user is recording; must be queued but NOT played!
        elif ticks[0] == 2:
            assert user_recording.is_set()
            return incoming_rows
        # Tick 3: User finishes recording and send completes. Now playback can proceed!
        elif ticks[0] == 3:
            user_recording.clear()
            return incoming_rows
        # Tick 4+: Stop
        elif ticks[0] >= 4:
            stop.set()
            return incoming_rows
        return incoming_rows

    watch(
        cfg,
        timeout=4,
        stop=stop,
        get_snapshot=snapshot_provider,
        press=mock_press,
        state=state,
        playing=playing,
        user_recording=user_recording,
    )

    # When user was recording, press was not called.
    # After user cleared recording, press was called to play the held note!
    assert mock_press.call_count >= 1
    assert mock_press.call_args[0][0] == "/0/2/0/0"


def test_dynamic_voice_path_resolution():
    """Verify resolve_voice_control locates play button by signature even when paths shift."""
    from OpenAgent.replies import resolve_voice_control

    cfg = Config(
        message_list_path="/0/2",
        incoming_marker="Incoming message",
        voice_play_marker="Play voice message",
        voice_pause_marker="Pause voice message",
    )

    # Snapshot 1: button is at /0/2/0/0
    rows1 = [
        {"path": "/0/2", "role": "AXList", "title": "", "description": "", "value": ""},
        {"path": "/0/2/0", "role": "AXGroup", "title": "Incoming message", "description": "", "value": ""},
        {"path": "/0/2/0/0", "role": "AXButton", "title": "Play voice message", "description": "0:09", "value": ""},
    ]
    target_sig = "Play voice message 0:09"

    # Snapshot 2: two new message bubbles inserted before it, shifting it to /0/2/2/0
    rows2 = [
        {"path": "/0/2", "role": "AXList", "title": "", "description": "", "value": ""},
        {"path": "/0/2/0", "role": "AXGroup", "title": "Your message", "description": "", "value": ""},
        {"path": "/0/2/0/0", "role": "AXStaticText", "title": "", "description": "", "value": "hello"},
        {"path": "/0/2/1", "role": "AXGroup", "title": "Your message", "description": "", "value": ""},
        {"path": "/0/2/1/0", "role": "AXStaticText", "title": "", "description": "", "value": "response"},
        {"path": "/0/2/2", "role": "AXGroup", "title": "Incoming message", "description": "", "value": ""},
        {"path": "/0/2/2/0", "role": "AXButton", "title": "Play voice message", "description": "0:09", "value": ""},
    ]

    # Stale path would have been /0/2/0/0, but resolve_voice_control finds the shifted /0/2/2/0!
    resolved = resolve_voice_control(rows2, cfg, target_sig, fallback_path="/0/2/0/0")
    assert resolved == "/0/2/2/0"


def test_pause_active_playback_helper():
    """Verify pause_active_playback locates active pause button and clicks it."""
    from OpenAgent.replies import pause_active_playback

    cfg = Config(
        message_list_path="/0/2",
        voice_pause_marker="Pause voice message",
    )

    rows = [
        {"path": "/0/2", "role": "AXList", "title": "", "description": "", "value": ""},
        {"path": "/0/2/0", "role": "AXGroup", "title": "Incoming message", "description": "", "value": ""},
        {"path": "/0/2/0/0", "role": "AXButton", "title": "Pause voice message", "description": "0:05", "value": ""},
    ]

    mock_press = MagicMock()
    paused = pause_active_playback(rows, cfg, press=mock_press)
    assert paused is True
    mock_press.assert_called_once_with("/0/2/0/0", expected_label="Pause voice message")


def test_wait_for_completion_interrupted_by_user_recording():
    """Playback wait must exit early and pause audio when user starts recording."""
    from OpenAgent.replies import _wait_for_completion

    cfg = Config(
        voice_play_marker="Play",
        voice_pause_marker="Pause",
        max_voice_seconds=30,
        message_list_path="/0/2",
    )

    rows = [
        {"path": "/0/2", "role": "AXList", "title": "", "description": "", "value": ""},
        {"path": "/0/2/0", "role": "AXButton", "title": "Pause", "description": "", "value": ""},
    ]

    mock_press = MagicMock()
    user_recording = threading.Event()
    user_recording.set()  # User starts recording!

    t0 = time.monotonic()
    _wait_for_completion(
        cfg=cfg,
        button_path="/0/2/0",
        dur=20,
        stop=None,
        get_snapshot=lambda **kw: rows,
        user_recording=user_recording,
        press=mock_press,
    )
    elapsed = time.monotonic() - t0

    # Must have exited almost immediately (< 1s) instead of waiting for 20s!
    assert elapsed < 2.0
    mock_press.assert_called_once_with("/0/2/0", expected_label="Pause")


def test_tool_response_waits_for_user_recording_to_complete():
    """Tool response must not be sent until user finishes recording."""
    cfg = Config(
        number="+16508702892",
        header_path="/0/1",
        message_list_path="/0/2",
        incoming_marker="Incoming message",
        safe_mode=False,
        ledger_path=":memory:",
    )

    base_rows = [
        {"path": "/0/1", "role": "AXButton", "title": "+1 (650) 870-2892", "description": "", "value": ""},
        {"path": "/0/2", "role": "AXList", "title": "", "description": "", "value": ""},
    ]

    new_rows = base_rows + [
        {"path": "/0/2/0", "role": "AXGroup", "title": "Incoming message", "description": "", "value": ""},
        {"path": "/0/2/0/0", "role": "AXStaticText", "title": "", "description": "", "value": '```json\n{"tool": "bash", "args": {"command": "echo unique_test_123"}}\n```'},
    ]

    mock_desk = MagicMock(spec=Desktop)
    mock_harness = MagicMock(spec=Harness)
    mock_harness.bash.return_value = {"exit_code": 0, "output": "hi", "timed_out": False}

    user_recording = threading.Event()
    user_recording.set()  # User is currently recording!
    stop = threading.Event()
    state = {"processed_texts": set()}

    ticks = [0]
    def snapshot_provider(**kw):
        ticks[0] += 1
        if ticks[0] == 1:
            return base_rows
        elif ticks[0] == 2:
            # User is recording when tool arrives; user finishes recording after 200ms
            threading.Timer(0.2, user_recording.clear).start()
            return new_rows
        elif ticks[0] >= 3:
            stop.set()
            return new_rows
        return new_rows

    watch(
        cfg,
        timeout=3,
        stop=stop,
        get_snapshot=snapshot_provider,
        desk=mock_desk,
        harness=mock_harness,
        state=state,
        user_recording=user_recording,
    )

    assert mock_harness.bash.call_count == 1
    assert mock_desk.send_tool_response.call_count == 1


def test_tool_call_not_blocked_by_voice_playback():
    """A tool call arriving while a voice note is playing must be dispatched immediately."""
    cfg = Config(
        number="+16508702892",
        header_path="/0/1",
        message_list_path="/0/2",
        incoming_marker="Incoming message",
        voice_play_marker="Play voice message",
        voice_pause_marker="Pause voice message",
        safe_mode=False,
        ledger_path=":memory:",
    )

    base_rows = [
        {"path": "/0/1", "role": "AXButton", "title": "+1 (650) 870-2892", "description": "", "value": ""},
        {"path": "/0/2", "role": "AXList", "title": "", "description": "", "value": ""},
    ]

    # Voice note with 60 second duration
    voice_note_rows = base_rows + [
        {"path": "/0/2/0", "role": "AXGroup", "title": "Incoming message", "description": "", "value": ""},
        {"path": "/0/2/0/0", "role": "AXButton", "title": "Play voice message", "description": "1:00", "value": ""},
    ]

    # While playing, tool call arrives
    tool_and_voice_rows = voice_note_rows + [
        {"path": "/0/2/1", "role": "AXGroup", "title": "Incoming message", "description": "", "value": ""},
        {"path": "/0/2/1/0", "role": "AXStaticText", "title": "", "description": "", "value": '```json\n{"tool": "bash", "args": {"command": "echo fast_reply"}}\n```'},
    ]

    mock_desk = MagicMock(spec=Desktop)
    mock_harness = MagicMock(spec=Harness)
    mock_harness.bash.return_value = {"exit_code": 0, "output": "fast_reply", "timed_out": False}

    playback_started = threading.Event()
    stop = threading.Event()
    state = {"processed_texts": set()}

    def mock_press(path, expected_label=None):
        playback_started.set()

    ticks = [0]
    def snapshot_provider(**kw):
        ticks[0] += 1
        if ticks[0] == 1:
            return base_rows
        elif ticks[0] == 2:
            return voice_note_rows
        else:
            return tool_and_voice_rows

    def on_send_response(reply):
        # As soon as the tool response is sent, stop watch
        stop.set()

    mock_desk.send_tool_response.side_effect = on_send_response

    t_start = time.monotonic()
    watch(
        cfg,
        timeout=3,
        stop=stop,
        get_snapshot=snapshot_provider,
        press=mock_press,
        desk=mock_desk,
        harness=mock_harness,
        state=state,
    )
    elapsed = time.monotonic() - t_start

    # Tool call should have executed and sent its response within < 1.5 seconds,
    # despite the voice note having a 60-second duration!
    assert elapsed < 1.5
    assert mock_harness.bash.call_count == 1
    assert mock_desk.send_tool_response.call_count == 1


def test_voice_note_never_requeued_in_loop():
    """Verify that an incoming voice note is queued exactly once and never re-queued on subsequent ticks."""
    cfg = Config(
        number="+16508702892",
        header_path="/0/1",
        message_list_path="/0/2",
        incoming_marker="Incoming message",
        voice_play_marker="Play voice message",
        voice_pause_marker="Pause voice message",
        safe_mode=False,
    )

    base_rows = [
        {"path": "/0/1", "role": "AXButton", "title": "+1 (650) 870-2892", "description": "", "value": ""},
        {"path": "/0/2", "role": "AXList", "title": "", "description": "", "value": ""},
    ]

    # Voice note with 36s duration
    unplayed_note = base_rows + [
        {"path": "/0/2/0", "role": "AXGroup", "title": "Incoming message", "description": "11:42 AM, Received from +16508702892", "value": ""},
        {"path": "/0/2/0/0", "role": "AXButton", "title": "Play voice message", "description": "0:36", "value": ""},
    ]

    # Same note while actively playing (pause marker active)
    playing_note = base_rows + [
        {"path": "/0/2/0", "role": "AXGroup", "title": "Incoming message", "description": "11:42 AM, Received from +16508702892", "value": ""},
        {"path": "/0/2/0/0", "role": "AXButton", "title": "Pause voice message", "description": "0:05 of 0:36", "value": ""},
    ]

    # Same note after playing completed (played / play button again)
    completed_note = base_rows + [
        {"path": "/0/2/0", "role": "AXGroup", "title": "Incoming message", "description": "11:42 AM, Received from +16508702892", "value": ""},
        {"path": "/0/2/0/0", "role": "AXButton", "title": "Play voice message", "description": "0:36, Played", "value": ""},
    ]

    mock_press = MagicMock()
    stop = threading.Event()
    state = {}

    ticks = [0]
    def snapshot_provider(**kw):
        ticks[0] += 1
        if ticks[0] == 1:
            return base_rows  # Startup: empty chat
        elif ticks[0] == 2:
            return unplayed_note  # Tick 2: 36s voice note arrives
        elif ticks[0] in (3, 4, 5):
            return playing_note  # Ticks 3-5: note is playing
        elif ticks[0] in (6, 7, 8):
            return completed_note  # Ticks 6-8: note finished playing
        else:
            stop.set()
            return completed_note

    watch(
        cfg,
        timeout=3,
        stop=stop,
        get_snapshot=snapshot_provider,
        press=mock_press,
        state=state,
    )

    # Must have triggered playback exactly ONCE, never re-queued in a loop!
    assert mock_press.call_count == 1
    assert len(state.get("queue", [])) == 0


def test_voice_note_startup_baseline_never_queued():
    """Verify that voice notes already in chat history on startup are never queued or played."""
    cfg = Config(
        number="+16508702892",
        header_path="/0/1",
        message_list_path="/0/2",
        incoming_marker="Incoming message",
        voice_play_marker="Play voice message",
        voice_pause_marker="Pause voice message",
        safe_mode=False,
    )

    existing_history = [
        {"path": "/0/1", "role": "AXButton", "title": "+1 (650) 870-2892", "description": "", "value": ""},
        {"path": "/0/2", "role": "AXList", "title": "", "description": "", "value": ""},
        {"path": "/0/2/0", "role": "AXGroup", "title": "Incoming message", "description": "10:30 AM, Received from +16508702892", "value": ""},
        {"path": "/0/2/0/0", "role": "AXButton", "title": "Play voice message", "description": "0:36", "value": ""},
    ]

    mock_press = MagicMock()
    stop = threading.Event()
    state = {}

    ticks = [0]
    def snapshot_provider(**kw):
        ticks[0] += 1
        if ticks[0] >= 4:
            stop.set()
        return existing_history

    watch(
        cfg,
        timeout=2,
        stop=stop,
        get_snapshot=snapshot_provider,
        press=mock_press,
        state=state,
    )

    # Historical voice note present on startup must NEVER be played!
    assert mock_press.call_count == 0
    assert len(state.get("queue", [])) == 0


def test_body_from_description_quoted_reply():
    """Verify that incoming messages quoting a previous message are properly extracted."""
    from OpenAgent.replies import _body_from_description, _timestamp_from_description

    # Incoming tool call replying to user
    desc = (
        "\u200eReplying to \u200eYou.\n"
        "\u200emessage, JARVIS_CALL:eyJ0b29sIjogIm1hY19hcHBzIiwgImFyZ3MiOiB7fX0=:END, 11:33\u202fAM, "
        "\u200eReceived from + 1,6 5 0,8 7 0,2 8 9 2.\n"
        "\u200eQuoted message.\ntry to play the Triangle Violin Song of DJ Muratti on my spotify, by operating my mac"
    )
    assert _body_from_description(desc) == "JARVIS_CALL:eyJ0b29sIjogIm1hY19hcHBzIiwgImFyZ3MiOiB7fX0=:END"
    assert _timestamp_from_description(desc) == "11:33 AM"

    # Incoming reply with named contact
    desc_contact = (
        "Replying to Hamdan.\n"
        "message, git status, 14:05, Received from +16508702892.\n"
        "Quoted message.\nwhat is the status"
    )
    assert _body_from_description(desc_contact) == "git status"
    assert _timestamp_from_description(desc_contact) == "14:05"

    # Outgoing reply (user replying to someone) must NOT extract
    desc_out_reply = (
        "\u200eReplying to \u200eInstinct.\n"
        "\u200eYour message, abort, 11:34\u202fAM, \u200eSent to + 1,6 5 0,8 7 0,2 8 9 2, \u200eDelivered"
    )
    assert _body_from_description(desc_out_reply) == ""


def test_incoming_texts_with_quoted_reply_and_dynamic_fallback():
    """Verify incoming_texts correctly extracts JARVIS_CALL from quoted reply and handles list fallback."""
    from OpenAgent.config import Config
    from OpenAgent.replies import incoming_texts

    # Calibrated list path intentionally wrong/shifted to test dynamic fallback
    cfg = Config(
        header_path="/0/1",
        message_list_path="/0/999/wrong/path",
        number="+16508702892",
        incoming_marker="Received from",
        safe_mode=False,
    )

    rows = [
        {"path": "/0/1", "role": "AXButton", "title": "+1 (650) 870-2892", "description": "", "value": ""},
        # Dynamic message list matching "Messages in chat with Instinct"
        {"path": "/0/2/1/0/0", "role": "AXGroup", "title": "", "description": "\u200eMessages in chat with Instinct", "value": ""},
        # Outgoing message
        {"path": "/0/2/1/0/0/0", "role": "AXStaticText", "title": "", "description": "\u200eYour message, try spotify, 11:30 AM", "value": ""},
        # Incoming quoted reply containing JARVIS_CALL
        {
            "path": "/0/2/1/0/0/1",
            "role": "AXStaticText",
            "title": "",
            "description": (
                "\u200eReplying to \u200eYou.\n"
                "\u200emessage, JARVIS_CALL:eyJ0b29sIjogIm1hY19hcHBzIiwgImFyZ3MiOiB7fX0=:END, 11:33\u202fAM, "
                "\u200eReceived from + 1,6 5 0,8 7 0,2 8 9 2.\n"
                "\u200eQuoted message.\ntry spotify"
            ),
            "value": "",
        },
    ]

    results = incoming_texts(rows, cfg)
    assert len(results) == 1
    grp_path, text, sig = results[0]
    assert grp_path == "/0/2/1/0/0/1"
    assert text == "JARVIS_CALL:eyJ0b29sIjogIm1hY19hcHBzIiwgImFyZ3MiOiB7fX0=:END"
    assert "11:33 AM" in sig


def test_sequential_voice_messages_autoplayed_in_order():
    """Verify that multiple incoming voice notes arriving in sequence are all played in exact order."""
    cfg = Config(
        number="+16508702892",
        header_path="/0/1",
        message_list_path="/0/2",
        incoming_marker="Incoming message",
        voice_play_marker="Play voice message",
        voice_pause_marker="Pause voice message",
        safe_mode=False,
    )

    base_rows = [
        {"path": "/0/1", "role": "AXButton", "title": "+1 (650) 870-2892", "description": "", "value": ""},
        {"path": "/0/2", "role": "AXList", "title": "", "description": "", "value": ""},
    ]

    # Two voice notes arriving together (Note 1: 1s, Note 2: 1s)
    two_voice_notes = base_rows + [
        {"path": "/0/2/0", "role": "AXGroup", "title": "Incoming message", "description": "11:42 AM, Received from +16508702892", "value": ""},
        {"path": "/0/2/0/0", "role": "AXButton", "title": "Play voice message", "description": "0:01", "value": ""},
        {"path": "/0/2/1", "role": "AXGroup", "title": "Incoming message", "description": "11:42 AM, Received from +16508702892", "value": ""},
        {"path": "/0/2/1/0", "role": "AXButton", "title": "Play voice message", "description": "0:01", "value": ""},
    ]

    pressed_targets = []
    stop = threading.Event()
    state = {}

    def mock_press(path, expected_label=None):
        pressed_targets.append(path)
        if len(pressed_targets) >= 2:
            stop.set()

    ticks = [0]
    def snapshot_provider(**kw):
        ticks[0] += 1
        if ticks[0] == 1:
            return base_rows
        return two_voice_notes

    watch(
        cfg,
        timeout=5,
        stop=stop,
        get_snapshot=snapshot_provider,
        press=mock_press,
        state=state,
    )

    # Both voice notes must have been played in exact sequence!
    assert len(pressed_targets) == 2
    assert pressed_targets[0] == "/0/2/0/0"
    assert pressed_targets[1] == "/0/2/1/0"


def test_unplayed_voice_notes_on_startup_are_autoplayed():
    """Verify that unplayed voice notes present in chat on startup are NOT baselined away, but played."""
    cfg = Config(
        number="+16508702892",
        header_path="/0/1",
        message_list_path="/0/2",
        incoming_marker="Incoming message",
        voice_play_marker="Play voice message",
        voice_pause_marker="Pause voice message",
        safe_mode=False,
    )

    # Chat history on startup containing an unplayed voice message
    startup_history = [
        {"path": "/0/1", "role": "AXButton", "title": "+1 (650) 870-2892", "description": "", "value": ""},
        {"path": "/0/2", "role": "AXList", "title": "", "description": "", "value": ""},
        {"path": "/0/2/0", "role": "AXGroup", "title": "Incoming message", "description": "10:30 AM, Received from +16508702892, Unplayed", "value": ""},
        {"path": "/0/2/0/0", "role": "AXButton", "title": "Play voice message", "description": "0:01", "value": ""},
    ]

    mock_press = MagicMock()
    stop = threading.Event()
    state = {}

    def on_press(path, expected_label=None):
        stop.set()

    mock_press.side_effect = on_press

    watch(
        cfg,
        timeout=3,
        stop=stop,
        get_snapshot=lambda **kw: startup_history,
        press=mock_press,
        state=state,
    )

    # Unplayed note on startup must have been played!
    assert mock_press.call_count == 1
    mock_press.assert_called_once_with("/0/2/0/0", expected_label="Play voice message")


def test_occurrence_based_voice_control_resolution():
    """Verify resolve_voice_control correctly distinguishes multiple voice notes with the same timestamp/duration."""
    from OpenAgent.replies import canonical_voice_signature, resolve_voice_control

    cfg = Config(
        message_list_path="/0/2",
        incoming_marker="Incoming message",
        voice_play_marker="Play voice message",
        voice_pause_marker="Pause voice message",
    )

    rows = [
        {"path": "/0/2", "role": "AXList", "title": "", "description": "", "value": ""},
        # Note 1: 11:42 AM, 24s
        {"path": "/0/2/0", "role": "AXGroup", "title": "Incoming message", "description": "11:42 AM, Received from +16508702892", "value": ""},
        {"path": "/0/2/0/0", "role": "AXButton", "title": "Play voice message", "description": "0:24", "value": ""},
        # Note 2: 11:42 AM, 24s (occurrence 1)
        {"path": "/0/2/1", "role": "AXGroup", "title": "Incoming message", "description": "11:42 AM, Received from +16508702892", "value": ""},
        {"path": "/0/2/1/0", "role": "AXButton", "title": "Play voice message", "description": "0:24", "value": ""},
    ]

    sig1 = canonical_voice_signature(rows[2], rows[1], cfg, occurrence=0)
    sig2 = canonical_voice_signature(rows[4], rows[3], cfg, occurrence=1)

    assert sig1 != sig2
    assert resolve_voice_control(rows, cfg, sig1) == "/0/2/0/0"
    assert resolve_voice_control(rows, cfg, sig2) == "/0/2/1/0"


def test_incoming_texts_large_tool_call_without_truncation():
    """Verify that messages longer than 1500 chars (e.g. 3000+ chars) are not truncated and parse cleanly."""
    from OpenAgent.replies import incoming_texts
    from OpenAgent.dispatcher import encode_tool_call, parse_tool_calls

    cfg = Config(
        number="+16508702892",
        message_list_path="/0/2",
        safe_mode=False,
    )
    # Create a large payload > 3000 chars
    large_cmd = "echo " + "a" * 2500
    envelope = encode_tool_call({"tool": "bash", "args": {"command": large_cmd}})
    assert len(envelope) > 3000

    desc = f"\u200emessage, {envelope}, 8:33\u202fPM, \u200eReceived from + 1,6 5 0,8 7 0,2 8 9 2"
    rows = [
        {"path": "/0/2", "role": "AXList", "title": "", "description": "\u200eMessages in chat", "value": ""},
        {"path": "/0/2/0", "role": "AXStaticText", "title": "", "description": desc, "value": ""},
    ]

    texts = incoming_texts(rows, cfg)
    assert len(texts) == 1
    _, body, _ = texts[0]
    assert body == envelope

    calls = parse_tool_calls(body)
    assert len(calls) == 1
    assert calls[0]["tool"] == "bash"
    assert calls[0]["args"]["command"] == large_cmd







