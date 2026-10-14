"""Unit tests for Headless WhatsApp CLI (wacli) Adapter."""
import tempfile
from pathlib import Path
from OpenAgent.wacli_adapter import WacliAdapter, get_default_wacli_adapter


def test_wacli_adapter_init():
    adapter = WacliAdapter()
    assert adapter.store_dir is not None
    assert isinstance(adapter.is_available(), bool)


def test_wacli_send_validation():
    adapter = WacliAdapter()
    # Missing 'to' recipient
    res = adapter.send(to="", message="Hello")
    assert res["status"] == "error"
    assert "Missing 'to'" in res["error"]

    # Missing 'message' text when sending text
    res = adapter.send(to="+1234567890", message="")
    assert res["status"] == "error"
    assert "Missing 'message'" in res["error"]

    # Non-existent file path
    res = adapter.send(to="+1234567890", message="Check file", file_path="/non/existent/file.pdf")
    assert res["status"] == "error"
    assert "File not found" in res["error"]


def test_wacli_search_validation():
    adapter = WacliAdapter()
    # Missing query
    res = adapter.search(query="")
    assert res["status"] == "error"
    assert "Missing 'query'" in res["error"]


def test_wacli_fallback_without_binary():
    adapter = WacliAdapter()
    # Force _get_bin to return None to test graceful fallback
    adapter._get_bin = lambda: None  # type: ignore[assignment]
    res = adapter.status()
    assert res["status"] == "error"
    assert "wacli is not installed" in res["error"]
    assert "install_hint" in res


def test_get_default_wacli_adapter():
    a1 = get_default_wacli_adapter()
    a2 = get_default_wacli_adapter()
    assert a1 is a2
