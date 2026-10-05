import json
import pytest
from unittest.mock import MagicMock

from OpenAgent.dispatcher import (
    execute_tool_call,
    format_tool_response,
    parse_tool_calls,
    encode_tool_call,
)
from OpenAgent.firecrawl_adapter import FirecrawlAdapter


@pytest.fixture
def mock_firecrawl():
    fc = MagicMock(spec=FirecrawlAdapter)
    fc.scrape.return_value = {
        "success": True,
        "data": {
            "markdown": "# Architecture\nAll about OpenAgent system design.",
            "metadata": {
                "title": "OpenAgent Docs",
                "sourceURL": "https://example.com/docs",
            },
        },
    }
    fc.search.return_value = {
        "success": True,
        "data": [
            {
                "title": "Search Hit 1",
                "url": "https://example.com/hit1",
                "markdown": "Hit 1 excerpt...",
            }
        ],
    }
    fc.crawl.return_value = {
        "success": True,
        "id": "crawl-abc-123",
        "url": "https://example.com",
    }
    fc.crawl_status.return_value = {
        "status": "completed",
        "total": 12,
        "completed": 12,
        "data": [
            {
                "url": "https://example.com/page1",
                "metadata": {"title": "Page 1", "sourceURL": "https://example.com/page1"},
            }
        ],
    }
    fc.map.return_value = {
        "success": True,
        "links": ["https://example.com/a", "https://example.com/b"],
    }
    fc.extract.return_value = {
        "success": True,
        "data": {"product": "SuperEngine", "version": "2.0"},
    }
    fc.doctor.return_value = {
        "status": "ok",
        "api_url": "http://localhost:3002",
        "reachable": True,
    }
    return fc


def test_dispatcher_execute_scrape(mock_firecrawl):
    call = {
        "tool": "firecrawl_scrape",
        "args": {"url": "https://example.com/docs", "only_main_content": True},
    }
    res = execute_tool_call(None, call, firecrawl_adapter=mock_firecrawl)
    assert res["status"] == "ok"
    assert res["tool"] == "firecrawl_scrape"
    mock_firecrawl.scrape.assert_called_once_with(
        url="https://example.com/docs",
        formats=None,
        only_main_content=True,
        wait_for=None,
        timeout=None,
        include_tags=None,
        exclude_tags=None,
        headers=None,
    )

    formatted = format_tool_response(res)
    assert "OpenAgent Docs" in formatted
    assert "https://example.com/docs" in formatted
    assert "Architecture" in formatted


def test_dispatcher_execute_search(mock_firecrawl):
    call = {
        "tool": "firecrawl_search",
        "args": {"query": "OpenAgent architecture", "limit": 3},
    }
    res = execute_tool_call(None, call, firecrawl_adapter=mock_firecrawl)
    assert res["status"] == "ok"
    mock_firecrawl.search.assert_called_once_with(
        query="OpenAgent architecture",
        limit=3,
        scrape_options=None,
    )

    formatted = format_tool_response(res)
    assert "Search Results (1 hits)" in formatted
    assert "Search Hit 1" in formatted


def test_dispatcher_execute_crawl_and_status(mock_firecrawl):
    # Crawl
    call_crawl = {
        "tool": "firecrawl_crawl",
        "args": {"url": "https://example.com", "max_depth": 3, "limit": 15},
    }
    res_crawl = execute_tool_call(None, call_crawl, firecrawl_adapter=mock_firecrawl)
    assert res_crawl["status"] == "ok"
    mock_firecrawl.crawl.assert_called_once()
    formatted_crawl = format_tool_response(res_crawl)
    assert "crawl-abc-123" in formatted_crawl

    # Status
    call_status = {
        "tool": "firecrawl_status",
        "args": {"job_id": "crawl-abc-123"},
    }
    res_status = execute_tool_call(None, call_status, firecrawl_adapter=mock_firecrawl)
    assert res_status["status"] == "ok"
    mock_firecrawl.crawl_status.assert_called_once_with(job_id="crawl-abc-123")
    formatted_status = format_tool_response(res_status)
    assert "completed (12/12 pages crawled)" in formatted_status


def test_dispatcher_execute_map(mock_firecrawl):
    call = {
        "tool": "firecrawl_map",
        "args": {"url": "https://example.com", "limit": 50},
    }
    res = execute_tool_call(None, call, firecrawl_adapter=mock_firecrawl)
    assert res["status"] == "ok"
    mock_firecrawl.map.assert_called_once_with(
        url="https://example.com",
        search=None,
        limit=50,
        ignore_sitemap=False,
    )
    formatted = format_tool_response(res)
    assert "Discovered Links (2)" in formatted
    assert "https://example.com/a" in formatted


def test_dispatcher_execute_extract(mock_firecrawl):
    call = {
        "tool": "firecrawl_extract",
        "args": {
            "urls": ["https://example.com/product"],
            "prompt": "Extract product details",
        },
    }
    res = execute_tool_call(None, call, firecrawl_adapter=mock_firecrawl)
    assert res["status"] == "ok"
    mock_firecrawl.extract.assert_called_once_with(
        urls=["https://example.com/product"],
        prompt="Extract product details",
        schema=None,
    )
    formatted = format_tool_response(res)
    assert "SuperEngine" in formatted


def test_dispatcher_firecrawl_jarvis_call_envelope(mock_firecrawl):
    payload = {
        "tool": "firecrawl_scrape",
        "args": {"url": "https://news.ycombinator.com"},
    }
    envelope = encode_tool_call(payload)
    calls = parse_tool_calls(envelope)
    assert len(calls) == 1
    assert calls[0]["tool"] == "firecrawl_scrape"
    assert calls[0]["args"]["url"] == "https://news.ycombinator.com"
