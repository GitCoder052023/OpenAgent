import json
import pytest
from unittest.mock import patch, MagicMock
from urllib.error import HTTPError, URLError

from OpenAgent.firecrawl_adapter import (
    FirecrawlAdapter,
    FirecrawlError,
    PROHIBITED_FIRECRAWL_DOMAINS,
    _check_url_allowed,
)


def test_firecrawl_adapter_init_defaults():
    adapter = FirecrawlAdapter()
    assert adapter.api_url == "http://localhost:3002"
    assert adapter.api_key == ""
    assert adapter.timeout == 60.0


def test_firecrawl_prohibited_domains():
    for domain in PROHIBITED_FIRECRAWL_DOMAINS:
        with pytest.raises(FirecrawlError, match="prohibited"):
            _check_url_allowed(f"https://{domain}/chat")
        with pytest.raises(FirecrawlError, match="prohibited"):
            _check_url_allowed(f"http://sub.{domain}/api")

    # Allowed domain should not raise
    _check_url_allowed("https://github.com/firecrawl/firecrawl")


def test_firecrawl_scrape_success():
    adapter = FirecrawlAdapter(api_url="http://localhost:3002")

    mock_resp_data = {
        "success": True,
        "data": {
            "markdown": "# Welcome\nThis is scraped content.",
            "metadata": {
                "title": "Welcome Page",
                "sourceURL": "https://example.com/welcome",
            },
        },
    }

    mock_urlopen = MagicMock()
    mock_urlopen.return_value.__enter__.return_value.getcode.return_value = 200
    mock_urlopen.return_value.__enter__.return_value.read.return_value = json.dumps(mock_resp_data).encode("utf-8")

    with patch("urllib.request.urlopen", mock_urlopen):
        res = adapter.scrape(url="https://example.com/welcome", formats=["markdown"], only_main_content=True)
        assert res["success"] is True
        assert res["data"]["markdown"].startswith("# Welcome")

        # Verify request details
        req = mock_urlopen.call_args[0][0]
        assert req.get_full_url() == "http://localhost:3002/v1/scrape"
        assert req.get_method() == "POST"
        body = json.loads(req.data.decode("utf-8"))
        assert body["url"] == "https://example.com/welcome"
        assert body["formats"] == ["markdown"]
        assert body["onlyMainContent"] is True


def test_firecrawl_search_success():
    adapter = FirecrawlAdapter(api_url="http://localhost:3002")

    mock_resp_data = {
        "success": True,
        "data": [
            {
                "title": "Doc 1",
                "url": "https://example.com/doc1",
                "markdown": "Content 1",
            },
            {
                "title": "Doc 2",
                "url": "https://example.com/doc2",
                "markdown": "Content 2",
            },
        ],
    }

    mock_urlopen = MagicMock()
    mock_urlopen.return_value.__enter__.return_value.getcode.return_value = 200
    mock_urlopen.return_value.__enter__.return_value.read.return_value = json.dumps(mock_resp_data).encode("utf-8")

    with patch("urllib.request.urlopen", mock_urlopen):
        res = adapter.search(query="python async", limit=2)
        assert res["success"] is True
        assert len(res["data"]) == 2

        req = mock_urlopen.call_args[0][0]
        assert req.get_full_url() == "http://localhost:3002/v1/search"
        body = json.loads(req.data.decode("utf-8"))
        assert body["query"] == "python async"
        assert body["limit"] == 2


def test_firecrawl_crawl_and_status():
    adapter = FirecrawlAdapter(api_url="http://localhost:3002")

    # 1. Start crawl
    mock_crawl_resp = {"success": True, "id": "job-12345", "url": "http://localhost:3002/v1/crawl/job-12345"}
    mock_urlopen = MagicMock()
    mock_urlopen.return_value.__enter__.return_value.getcode.return_value = 200
    mock_urlopen.return_value.__enter__.return_value.read.return_value = json.dumps(mock_crawl_resp).encode("utf-8")

    with patch("urllib.request.urlopen", mock_urlopen):
        start_res = adapter.crawl(url="https://docs.example.com", max_depth=3, limit=20)
        assert start_res["id"] == "job-12345"

    # 2. Check crawl status
    mock_status_resp = {
        "status": "completed",
        "total": 5,
        "completed": 5,
        "data": [{"markdown": "page 1", "metadata": {"sourceURL": "https://docs.example.com/1"}}],
    }
    mock_urlopen.return_value.__enter__.return_value.read.return_value = json.dumps(mock_status_resp).encode("utf-8")

    with patch("urllib.request.urlopen", mock_urlopen):
        status_res = adapter.crawl_status(job_id="job-12345")
        assert status_res["status"] == "completed"
        assert status_res["completed"] == 5


def test_firecrawl_map_success():
    adapter = FirecrawlAdapter(api_url="http://localhost:3002")

    mock_resp = {
        "success": True,
        "links": [
            "https://example.com/about",
            "https://example.com/contact",
            "https://example.com/pricing",
        ],
    }

    mock_urlopen = MagicMock()
    mock_urlopen.return_value.__enter__.return_value.getcode.return_value = 200
    mock_urlopen.return_value.__enter__.return_value.read.return_value = json.dumps(mock_resp).encode("utf-8")

    with patch("urllib.request.urlopen", mock_urlopen):
        res = adapter.map(url="https://example.com", limit=50)
        assert res["success"] is True
        assert len(res["links"]) == 3


def test_firecrawl_extract_success():
    adapter = FirecrawlAdapter(api_url="http://localhost:3002")

    mock_resp = {
        "success": True,
        "data": {"company": "Acme Corp", "employees": 42},
    }

    mock_urlopen = MagicMock()
    mock_urlopen.return_value.__enter__.return_value.getcode.return_value = 200
    mock_urlopen.return_value.__enter__.return_value.read.return_value = json.dumps(mock_resp).encode("utf-8")

    with patch("urllib.request.urlopen", mock_urlopen):
        res = adapter.extract(
            urls=["https://example.com/about"],
            prompt="Extract company name and employee count",
            schema={"type": "object", "properties": {"company": {"type": "string"}}},
        )
        assert res["success"] is True
        assert res["data"]["company"] == "Acme Corp"


def test_firecrawl_connection_error_helpful_message():
    adapter = FirecrawlAdapter(api_url="http://localhost:3002")

    with patch("urllib.request.urlopen", side_effect=URLError("Connection refused")):
        with pytest.raises(FirecrawlError) as exc_info:
            adapter.scrape(url="https://example.com")
        assert "Ensure Firecrawl Docker services are running" in str(exc_info.value)
