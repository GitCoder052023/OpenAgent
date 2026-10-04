"""Unit and integration tests for BrowserAdapter and Browser Tools in OpenAgent."""

import pytest
from unittest.mock import MagicMock, patch

from OpenAgent.browser_adapter import (
    BrowserAdapter,
    BrowserError,
    _check_url_allowed,
    PROHIBITED_BROWSER_DOMAINS,
)
from OpenAgent.dispatcher import (
    parse_tool_call,
    execute_tool_call,
    format_tool_response,
    encode_tool_call,
)


# ---------------------------------------------------------------------------
# 1. Safety Guard Tests
# ---------------------------------------------------------------------------
def test_whatsapp_url_safety_protection():
    """Ensure targeting WhatsApp Web is strictly forbidden."""
    for bad_url in (
        "https://web.whatsapp.com",
        "http://web.whatsapp.com/",
        "web.whatsapp.com",
        "https://www.whatsapp.com/chat",
        "https://api.whatsapp.com/send",
    ):
        with pytest.raises(BrowserError, match="prohibited"):
            _check_url_allowed(bad_url)

    # Allowed URLs should pass without raising
    _check_url_allowed("https://github.com")
    _check_url_allowed("https://google.com")
    _check_url_allowed("https://x.com/explore")
    _check_url_allowed(None)


# ---------------------------------------------------------------------------
# 2. BrowserAdapter Core Primitive Tests
# ---------------------------------------------------------------------------
def test_browser_adapter_open_and_info():
    """Verify open and page_info delegate to browser helpers."""
    mock_helpers = MagicMock()
    mock_helpers.goto_url.return_value = {"status": "ok"}
    mock_helpers.new_tab.return_value = {"status": "ok", "tab_id": "tab123"}
    mock_helpers.page_info.return_value = {
        "url": "https://github.com",
        "title": "GitHub",
        "w": 1280,
        "h": 800,
        "sx": 0,
        "sy": 0,
    }

    adapter = BrowserAdapter(helpers=mock_helpers)

    # Test open on current tab
    res_goto = adapter.open("https://github.com", new_tab=False)
    mock_helpers.goto_url.assert_called_once_with("https://github.com")
    assert res_goto["status"] == "ok"
    assert res_goto["title"] == "GitHub"

    # Test open in new tab
    res_new = adapter.open("https://google.com", new_tab=True)
    mock_helpers.new_tab.assert_called_once_with("https://google.com")
    assert res_new["status"] == "ok"

    # Test page_info
    info = adapter.page_info()
    assert info["title"] == "GitHub"
    assert info["w"] == 1280


def test_browser_adapter_click_coordinates_and_selector():
    """Verify click works with coordinates and selector resolution."""
    mock_helpers = MagicMock()
    mock_helpers.js.return_value = {"x": 450.0, "y": 120.0}
    adapter = BrowserAdapter(helpers=mock_helpers)

    # Coordinate click
    res1 = adapter.click(x=100.5, y=200.5, button="left", clicks=2)
    mock_helpers.click_at_xy.assert_called_with(100.5, 200.5, button="left", clicks=2)
    assert res1["status"] == "ok"
    assert res1["x"] == 100.5

    # Selector click (auto-resolves bounding rect center)
    res2 = adapter.click(selector="button#submit")
    mock_helpers.click_at_xy.assert_called_with(450.0, 120.0, button="left", clicks=1)
    assert res2["status"] == "ok"
    assert res2["x"] == 450.0
    assert res2["y"] == 120.0

    # Missing both coords and selector raises ValueError
    with pytest.raises(ValueError, match="Either"):
        adapter.click()


def test_browser_adapter_fill_and_type_and_key():
    """Verify fill_input, type_text, and press_key delegation."""
    mock_helpers = MagicMock()
    adapter = BrowserAdapter(helpers=mock_helpers)

    # Fill
    res_fill = adapter.fill("input.search", "OpenAgent", clear_first=True, timeout=3.0)
    mock_helpers.fill_input.assert_called_once_with("input.search", "OpenAgent", clear_first=True, timeout=3.0)
    assert res_fill["status"] == "ok"
    assert res_fill["length"] == 9

    # Type
    res_type = adapter.type("Direct text")
    mock_helpers.type_text.assert_called_once_with("Direct text")
    assert res_type["status"] == "ok"

    # Key
    res_key = adapter.key("Enter")
    mock_helpers.press_key.assert_called_once_with("Enter", modifiers=0)
    assert res_key["status"] == "ok"


def test_browser_adapter_tabs_management():
    """Verify tab operations."""
    mock_helpers = MagicMock()
    mock_helpers.list_tabs.return_value = [{"tab_id": "1", "title": "Home", "url": "https://example.com"}]
    mock_helpers.new_tab.return_value = {"tab_id": "2"}
    mock_helpers.switch_tab.return_value = {"tab_id": "1"}
    mock_helpers.close_tab.return_value = {"status": "closed"}
    mock_helpers.current_tab.return_value = {"tab_id": "1"}

    adapter = BrowserAdapter(helpers=mock_helpers)

    assert adapter.tabs("list")["total"] == 1
    assert adapter.tabs("new", url="https://example.com")["status"] == "ok"
    assert adapter.tabs("switch", target="1")["status"] == "ok"
    assert adapter.tabs("close", target="2")["status"] == "ok"
    assert adapter.tabs("current")["tab"]["tab_id"] == "1"

    with pytest.raises(ValueError, match="Unknown tabs action"):
        adapter.tabs("invalid_action")


def test_browser_adapter_screenshot_and_see():
    """Verify screenshot capture and perception summary with attachment signals."""
    mock_helpers = MagicMock()
    mock_helpers.capture_screenshot.return_value = "/tmp/browser_shot.png"
    mock_helpers.page_info.return_value = {"url": "https://example.com", "title": "Example", "w": 1280, "h": 800}
    mock_helpers.cdp.return_value = {"nodes": []}

    adapter = BrowserAdapter(helpers=mock_helpers)

    # Screenshot with send_image
    res_shot = adapter.screenshot(send_image=True)
    assert res_shot["path"] == "/tmp/browser_shot.png"
    assert res_shot["_send_attachment"] == "/tmp/browser_shot.png"

    # See perception summary
    res_see = adapter.see(send_image=True)
    assert res_see["url"] == "https://example.com"
    assert res_see["title"] == "Example"
    assert res_see["_send_attachment"] == "/tmp/browser_shot.png"


def test_browser_adapter_ax_tree_query():
    """Verify Accessibility tree query with coordinate extraction."""
    mock_helpers = MagicMock()
    mock_helpers.cdp.side_effect = [
        # 1. getFullAXTree
        {
            "nodes": [
                {
                    "backendDOMNodeId": 101,
                    "role": {"value": "button"},
                    "name": {"value": "Search Now"},
                },
                {
                    "backendDOMNodeId": 102,
                    "role": {"value": "link"},
                    "name": {"value": "Documentation"},
                },
            ]
        },
        # 2. DOM.getBoxModel for 101
        {"model": {"content": [100, 50, 200, 50, 200, 90, 100, 90]}},
        # 3. DOM.getBoxModel for 102
        {"model": {"content": [300, 50, 400, 50, 400, 90, 300, 90]}},
    ]

    adapter = BrowserAdapter(helpers=mock_helpers)
    res = adapter.ax(action="query", text="Search")
    assert res["status"] == "ok"
    assert res["total"] == 1
    node = res["elements"][0]
    assert node["name"] == "Search Now"
    assert node["x"] == 150.0  # (100+200+200+100)/4
    assert node["y"] == 70.0   # (50+50+90+90)/4


def test_browser_adapter_compound_run_python():
    """Verify local compound Python script execution."""
    mock_helpers = MagicMock()
    mock_helpers.page_info.return_value = {"title": "Test Title"}
    adapter = BrowserAdapter(helpers=mock_helpers)

    script = """
print(f"Current title: {page_info()['title']}")
x = 10 * 5
print(f"Calculated: {x}")
"""
    res = adapter.run_python(script)
    assert res["status"] == "ok"
    assert "Current title: Test Title" in res["stdout"]
    assert "Calculated: 50" in res["stdout"]
    assert "duration_s" in res


# ---------------------------------------------------------------------------
# 3. Dispatcher Integration Tests for Browser Tools
# ---------------------------------------------------------------------------
def test_dispatch_browser_tools():
    """Verify execute_tool_call handles all browser_* tools."""
    mock_browser = MagicMock()
    mock_browser.open.return_value = {"status": "ok", "url": "https://example.com", "title": "Example"}
    mock_browser.page_info.return_value = {"url": "https://example.com", "title": "Example", "w": 1280, "h": 800, "sx": 0, "sy": 0}
    mock_browser.click.return_value = {"status": "ok", "x": 100, "y": 200, "button": "left", "click_count": 1}
    mock_browser.fill.return_value = {"status": "ok", "selector": "#name", "length": 4}
    mock_browser.type.return_value = {"status": "ok", "length": 5}
    mock_browser.key.return_value = {"status": "ok", "key": "Enter"}
    mock_browser.tabs.return_value = {"status": "ok", "tabs": [{"title": "Tab 1", "url": "https://example.com", "selected": True}]}
    mock_browser.see.return_value = {
        "status": "ok",
        "title": "Example",
        "url": "https://example.com",
        "width": 1280,
        "height": 800,
        "_send_attachment": "/tmp/b.png",
        "interactive_controls": ["Button: 'Go' at (100, 200)"],
    }
    mock_browser.ax.return_value = {"status": "ok", "total": 1, "elements": [{"role": "button", "name": "Go", "x": 100, "y": 200}]}
    mock_browser.js.return_value = "Page Title"
    mock_browser.wait.return_value = {"status": "ok", "waited_for": "load"}
    mock_browser.run_python.return_value = {"status": "ok", "stdout": "Done", "duration_s": 0.05}

    # 1. browser_open
    r_open = execute_tool_call(None, {"tool": "browser_open", "args": {"url": "https://example.com"}}, browser_adapter=mock_browser)
    assert r_open["status"] == "ok"
    mock_browser.open.assert_called_once_with(url="https://example.com", new_tab=False)

    # 2. browser_info
    r_info = execute_tool_call(None, {"tool": "browser_info", "args": {}}, browser_adapter=mock_browser)
    assert r_info["status"] == "ok"

    # 3. browser_click
    r_click = execute_tool_call(None, {"tool": "browser_click", "args": {"x": 100, "y": 200}}, browser_adapter=mock_browser)
    assert r_click["status"] == "ok"

    # 4. browser_fill
    r_fill = execute_tool_call(None, {"tool": "browser_fill", "args": {"selector": "#name", "text": "John"}}, browser_adapter=mock_browser)
    assert r_fill["status"] == "ok"

    # 5. browser_tabs
    r_tabs = execute_tool_call(None, {"tool": "browser_tabs", "args": {"action": "list"}}, browser_adapter=mock_browser)
    assert r_tabs["status"] == "ok"

    # 6. browser_see
    r_see = execute_tool_call(None, {"tool": "browser_see", "args": {"send_image": True}}, browser_adapter=mock_browser)
    assert r_see["status"] == "ok"
    assert r_see["result"]["_send_attachment"] == "/tmp/b.png"

    # 7. browser_python
    r_py = execute_tool_call(None, {"tool": "browser_python", "args": {"code": "print('Done')"}}, browser_adapter=mock_browser)
    assert r_py["status"] == "ok"
    assert r_py["result"]["stdout"] == "Done"


def test_format_browser_responses():
    """Verify format_tool_response produces human-readable WhatsApp markdown for browser_* tools."""
    # browser_open
    r_open = {"status": "ok", "tool": "browser_open", "result": {"url": "https://github.com", "title": "GitHub", "navigation": {"domain_skills": ["github-api.md"]}}}
    fmt_open = format_tool_response(r_open)
    assert "Navigated to: https://github.com" in fmt_open
    assert "Title: GitHub" in fmt_open
    assert "Domain Skills: github-api.md" in fmt_open

    # browser_click
    r_click = {"status": "ok", "tool": "browser_click", "result": {"x": 120, "y": 240, "selector": "#btn", "button": "left", "click_count": 1}}
    fmt_click = format_tool_response(r_click)
    assert "Clicked (120, 240) [#btn] on Chrome" in fmt_click

    # browser_fill
    r_fill = {"status": "ok", "tool": "browser_fill", "result": {"selector": "input.search", "length": 15}}
    fmt_fill = format_tool_response(r_fill)
    assert "Filled input 'input.search' (15 chars)" in fmt_fill

    # browser_see
    r_see = {
        "status": "ok",
        "tool": "browser_see",
        "result": {
            "title": "Example Domain",
            "url": "https://example.com",
            "_send_attachment": "/tmp/shot.png",
            "interactive_controls": ["Link: 'More information' at (400, 300)"],
        },
    }
    fmt_see = format_tool_response(r_see)
    assert "Captured Chrome: 'Example Domain'" in fmt_see
    assert "Screenshot attachment queued" in fmt_see
    assert "Link: 'More information'" in fmt_see

    # browser_tabs
    r_tabs = {
        "status": "ok",
        "tool": "browser_tabs",
        "result": {
            "action": "list",
            "tabs": [
                {"title": "OpenAgent", "url": "https://github.com", "selected": True},
                {"title": "Google", "url": "https://google.com", "selected": False},
            ],
        },
    }
    fmt_tabs = format_tool_response(r_tabs)
    assert "Open Chrome Tabs (2):" in fmt_tabs
    assert "🐎 OpenAgent" in fmt_tabs
    assert "• Google" in fmt_tabs


def test_legacy_mac_browser_routing():
    """Verify legacy mac_browser tool call still works via browser_adapter."""
    mock_browser = MagicMock()
    mock_browser.browser_op.return_value = {"title": "Legacy Chrome"}

    call = {"tool": "mac_browser", "args": {"action": "page_info"}}
    res = execute_tool_call(None, call, browser_adapter=mock_browser)
    assert res["status"] == "ok"
    assert res["tool"] == "mac_browser"
    mock_browser.browser_op.assert_called_once_with("page_info")
