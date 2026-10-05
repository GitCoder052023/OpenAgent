import json
import pytest
from unittest.mock import patch, MagicMock
from pathlib import Path

from OpenAgent.loco_adapter import (
    LocoAdapter,
    LocoError,
    DEFAULT_TARGET_PORTS,
    PROHIBITED_DOMAINS,
)


def test_loco_adapter_init_defaults():
    adapter = LocoAdapter()
    assert adapter.root.name == "locoagent"
    assert adapter.timeout == 120.0
    assert adapter.bun_bin is not None
    assert adapter.agent_browser_bin is not None


def test_loco_targets_resolution():
    adapter = LocoAdapter()
    targets = adapter.get_targets()
    assert "x" in targets
    assert "linkedin" in targets
    assert "reddit" in targets
    assert "instagram" in targets
    assert "facebook" in targets
    assert "threads" in targets
    assert "youtube" in targets
    assert "tiktok" in targets
    assert "github" in targets

    # Port resolution
    assert adapter.get_port_for_platform("x") == 9222
    assert adapter.get_port_for_platform("twitter") == 9222
    assert adapter.get_port_for_platform("linkedin") == 9223
    assert adapter.get_port_for_platform("reddit") == 9224
    assert adapter.get_port_for_platform("instagram") == 9225
    assert adapter.get_port_for_platform("facebook") == 9226
    assert adapter.get_port_for_platform("threads") == 9227
    assert adapter.get_port_for_platform("youtube") == 9228
    assert adapter.get_port_for_platform("tiktok") == 9229
    assert adapter.get_port_for_platform("github") == 9230


def test_loco_list_targets_status():
    adapter = LocoAdapter()
    res = adapter.list_targets_status()
    assert "targets" in res
    assert res["total"] >= 9
    assert "x" in res["targets"]
    assert res["targets"]["x"]["cdp_port"] == 9222


def test_prohibited_domains():
    adapter = LocoAdapter()
    for domain in PROHIBITED_DOMAINS:
        with pytest.raises(LocoError, match="prohibited"):
            adapter.open_url("x", f"https://{domain}/chat")


def test_check_dedup_flow():
    adapter = LocoAdapter()
    with patch.object(adapter, "_run_bun") as mock_bun:
        mock_bun.return_value = {"exit_code": 0, "stdout": "done"}
        res = adapter.check_dedup("x", "like", "https://x.com/post/123")
        assert res["already_done"] is True
        assert res["platform"] == "x"

        mock_bun.return_value = {"exit_code": 1, "stdout": "not found"}
        res2 = adapter.check_dedup("x", "like", "https://x.com/post/456")
        assert res2["already_done"] is False


def test_log_action_flow():
    adapter = LocoAdapter()
    with patch.object(adapter, "_run_bun") as mock_bun:
        mock_bun.return_value = {"exit_code": 0, "stdout": '{"ok": true}'}
        res = adapter.log_action("x", "like", "https://x.com/post/123", status="success", note="test like")
        assert res["status"] == "ok"
        assert res["logged"] is True


def test_workflow_methods():
    adapter = LocoAdapter()
    with patch.object(adapter, "_run_bun") as mock_bun:
        mock_bun.return_value = {"exit_code": 0, "stdout": "hf-papers-to-x (daily)"}
        res = adapter.workflow_list()
        assert res["status"] == "ok"
        assert "hf-papers-to-x" in res["output"]

        mock_bun.return_value = {"exit_code": 0, "stdout": "idle"}
        res_status = adapter.workflow_status(workflow_id="hf-papers-to-x")
        assert res_status["status"] == "ok"


def test_like_post_dedup_skips():
    adapter = LocoAdapter()
    with patch.object(adapter, "check_dedup") as mock_dedup:
        mock_dedup.return_value = {"already_done": True}
        res = adapter.like_post("x", "https://x.com/post/already_liked")
        assert res["status"] == "ok"
        assert res["skipped"] is True
        assert "already" in res["reason"]


def test_platform_home_urls():
    from OpenAgent.loco_adapter import PLATFORM_HOME_URLS
    assert PLATFORM_HOME_URLS["threads"] == "https://www.threads.net"
    assert PLATFORM_HOME_URLS["reddit"] == "https://www.reddit.com"
    assert "threads.com" not in PLATFORM_HOME_URLS["threads"]


def test_like_post_reddit_upvote():
    adapter = LocoAdapter()
    with patch.object(adapter, "check_dedup") as mock_dedup, \
         patch.object(adapter, "open_url") as mock_open, \
         patch.object(adapter, "snapshot") as mock_snap, \
         patch.object(adapter, "exec_agent_browser") as mock_exec, \
         patch.object(adapter, "log_action") as mock_log:
        mock_dedup.return_value = {"already_done": False}
        mock_open.return_value = {"status": "ok"}
        mock_snap.return_value = {"output": 'button "Upvote" [@e42]'}
        mock_exec.return_value = {"status": "ok"}

        res = adapter.like_post("reddit", "https://www.reddit.com/r/LocalLLaMA/comments/123/test")
        assert res["status"] == "ok"
        assert res["action"] == "upvote"
        assert res["ref_clicked"] == "@e42"
        mock_dedup.assert_called_once_with("reddit", "upvote", "https://www.reddit.com/r/LocalLLaMA/comments/123/test")
        mock_log.assert_called_once_with("reddit", "upvote", "https://www.reddit.com/r/LocalLLaMA/comments/123/test", status="success")


def test_search_threads_and_reddit():
    adapter = LocoAdapter()
    with patch.object(adapter, "open_url") as mock_open, \
         patch.object(adapter, "snapshot") as mock_snap, \
         patch.object(adapter, "screenshot") as mock_shot:
        mock_open.return_value = {"status": "ok"}
        mock_snap.return_value = {"output": "sample results"}
        mock_shot.return_value = {"screenshot_path": "/tmp/test.png"}

        res_threads = adapter.search("threads", "agentic workflows")
        assert res_threads["status"] == "ok"
        assert "threads.net/search?q=agentic%20workflows" in res_threads["url"]

        res_reddit = adapter.search("reddit", "deepseek", subreddit="LocalLLaMA")
        assert res_reddit["status"] == "ok"
        assert "reddit.com/r/LocalLLaMA/search/?q=deepseek" in res_reddit["url"]

