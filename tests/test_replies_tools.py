import pytest
import threading
from unittest.mock import MagicMock
from bridge.config import Config
from bridge.replies import incoming_texts, watch
from bridge.desktop import Desktop
from bridge.harness import OpenCodeHarness


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
    assert sig.startswith("/0/2/0:")


def test_incoming_texts_requires_list_path():
    cfg = Config(message_list_path="")
    assert incoming_texts([], cfg) == []


def test_watch_baselines_existing_tool_calls():
    cfg = Config(
        number="+16508702892",
        header_path="/0/1",
        message_list_path="/0/2",
        incoming_marker="Incoming message",
    )
    initial_rows = [
        {"path": "/0/1", "role": "AXStaticText", "title": "+1 (650) 870-2892", "description": "", "value": ""},
        {"path": "/0/2", "role": "AXList", "title": "", "description": "", "value": ""},
        {"path": "/0/2/0", "role": "AXGroup", "title": "Incoming message", "description": "", "value": ""},
        {"path": "/0/2/0/0", "role": "AXStaticText", "title": "", "description": "", "value": '{"tool": "bash", "args": {"command": "git log"}}'},
    ]

    mock_desk = MagicMock(spec=Desktop)
    mock_harness = MagicMock(spec=OpenCodeHarness)
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
    mock_harness = MagicMock(spec=OpenCodeHarness)
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
