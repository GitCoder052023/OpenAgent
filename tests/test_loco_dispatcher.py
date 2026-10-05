import json
import pytest
from unittest.mock import MagicMock

from OpenAgent.dispatcher import (
    execute_tool_call,
    format_tool_response,
    parse_tool_calls,
    encode_tool_call,
)
from OpenAgent.loco_adapter import LocoAdapter


@pytest.fixture
def mock_loco():
    loco = MagicMock(spec=LocoAdapter)
    loco.list_targets_status.return_value = {
        "targets": {
            "x": {"cdp_port": 9222, "online": True, "account": "hamdan"},
            "linkedin": {"cdp_port": 9223, "online": False, "account": None},
        },
        "total": 2,
        "online_count": 1,
    }
    loco.setup_chrome.return_value = {
        "status": "ok",
        "target": "x",
        "cdp_online": True,
        "output": "Chrome launched on port 9222",
    }
    loco.post_content.return_value = {
        "status": "ok",
        "action": "post",
        "text": "Hello world from OpenAgent!",
        "_send_attachment": "/tmp/post_screenshot.png",
    }
    loco.reply_to_post.return_value = {
        "status": "ok",
        "action": "reply",
        "url": "https://x.com/user/status/123",
        "reply_text": "Great insights!",
        "_send_attachment": "/tmp/reply_screenshot.png",
    }
    loco.like_post.return_value = {
        "status": "ok",
        "action": "like",
        "url": "https://x.com/user/status/123",
    }
    loco.search.return_value = {
        "status": "ok",
        "platform": "x",
        "query": "AI agents",
        "results_preview": "Top posts about AI agents...",
        "_send_attachment": "/tmp/search_screenshot.png",
    }
    loco.workflow_list.return_value = {
        "status": "ok",
        "output": "hf-papers-to-x: idle\nx-search-reply: idle",
    }
    loco.workflow_run.return_value = {
        "status": "ok",
        "workflow_id": "hf-papers-to-x",
        "output": "Steps completed: 1/1",
    }
    loco.check_dedup.return_value = {
        "status": "ok",
        "already_done": False,
        "platform": "x",
        "action": "like",
        "url": "https://x.com/user/status/123",
    }
    loco.doctor.return_value = {
        "status": "ok",
        "output": "DOCTOR: all critical checks passed",
    }
    return loco


def test_dispatch_social_targets(mock_loco):
    call = {"tool": "social_targets", "args": {}}
    res = execute_tool_call(None, call, loco_adapter=mock_loco)
    assert res["status"] == "ok"
    assert res["result"]["online_count"] == 1
    mock_loco.list_targets_status.assert_called_once()

    formatted = format_tool_response(res)
    assert "🟢 X" in formatted
    assert "9222" in formatted


def test_dispatch_social_setup(mock_loco):
    call = {"tool": "social_setup", "args": {"target": "x"}}
    res = execute_tool_call(None, call, loco_adapter=mock_loco)
    assert res["status"] == "ok"
    mock_loco.setup_chrome.assert_called_once_with(target="x", reset=False, all_targets=False)

    formatted = format_tool_response(res)
    assert "Chrome Setup for 'x'" in formatted


def test_dispatch_social_post(mock_loco):
    call = {
        "tool": "social_post",
        "args": {"platform": "x", "text": "Hello world from OpenAgent!"},
    }
    res = execute_tool_call(None, call, loco_adapter=mock_loco)
    assert res["status"] == "ok"
    assert res["result"]["text"] == "Hello world from OpenAgent!"
    assert res["result"]["_send_attachment"] == "/tmp/post_screenshot.png"
    mock_loco.post_content.assert_called_once()

    formatted = format_tool_response(res)
    assert "Post Published" in formatted
    assert "Screenshot confirmation queued" in formatted


def test_dispatch_social_reply(mock_loco):
    call = {
        "tool": "social_reply",
        "args": {
            "platform": "x",
            "url": "https://x.com/user/status/123",
            "text": "Great insights!",
        },
    }
    res = execute_tool_call(None, call, loco_adapter=mock_loco)
    assert res["status"] == "ok"
    mock_loco.reply_to_post.assert_called_once()

    formatted = format_tool_response(res)
    assert "Reply Sent" in formatted
    assert "Great insights!" in formatted


def test_dispatch_social_like(mock_loco):
    call = {
        "tool": "social_like",
        "args": {"platform": "x", "url": "https://x.com/user/status/123"},
    }
    res = execute_tool_call(None, call, loco_adapter=mock_loco)
    assert res["status"] == "ok"
    mock_loco.like_post.assert_called_once()

    formatted = format_tool_response(res)
    assert "Liked Post" in formatted


def test_dispatch_social_search(mock_loco):
    call = {
        "tool": "social_search",
        "args": {"platform": "x", "query": "AI agents"},
    }
    res = execute_tool_call(None, call, loco_adapter=mock_loco)
    assert res["status"] == "ok"
    mock_loco.search.assert_called_once_with(platform="x", query="AI agents", tab="latest", subreddit=None)

    formatted = format_tool_response(res)
    assert "Search Results for 'AI agents'" in formatted


def test_dispatch_social_workflow(mock_loco):
    call = {
        "tool": "social_workflow",
        "args": {"action": "run", "id": "hf-papers-to-x"},
    }
    res = execute_tool_call(None, call, loco_adapter=mock_loco)
    assert res["status"] == "ok"
    mock_loco.workflow_run.assert_called_once_with(workflow_id="hf-papers-to-x")

    formatted = format_tool_response(res)
    assert "Social Workflow Output" in formatted


def test_envelope_roundtrip_social_call():
    orig_call = {
        "tool": "social_post",
        "args": {"platform": "threads", "text": "Autonomous test thread"},
    }
    envelope = encode_tool_call(orig_call)
    assert envelope.startswith("JARVIS_CALL:")
    assert envelope.endswith(":END")

    parsed = parse_tool_calls(envelope)
    assert len(parsed) == 1
    assert parsed[0]["tool"] == "social_post"
    assert parsed[0]["args"]["text"] == "Autonomous test thread"


def test_dispatch_defaults_to_threads(mock_loco):
    # Calling social_post without platform or target arg defaults to 'threads'
    call = {
        "tool": "social_post",
        "args": {"text": "Default to threads post"},
    }
    res = execute_tool_call(None, call, loco_adapter=mock_loco)
    assert res["status"] == "ok"
    mock_loco.post_content.assert_called_with(
        platform="threads",
        text="Default to threads post",
        media_path=None,
        title=None,
        subreddit=None,
    )


def test_dispatch_reddit_upvote_formatting(mock_loco):
    mock_loco.like_post.return_value = {
        "status": "ok",
        "action": "upvote",
        "url": "https://www.reddit.com/r/LocalLLaMA/comments/123",
    }
    call = {
        "tool": "social_like",
        "args": {"platform": "reddit", "url": "https://www.reddit.com/r/LocalLLaMA/comments/123"},
    }
    res = execute_tool_call(None, call, loco_adapter=mock_loco)
    formatted = format_tool_response(res)
    assert "⬆️ Upvoted Reddit Post" in formatted
    assert "https://www.reddit.com/r/LocalLLaMA/comments/123" in formatted

