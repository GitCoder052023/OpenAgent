"""Firecrawl Adapter for OpenAgent.

Integrates the self-hosted Firecrawl web ingestion, crawling, mapping, and
extraction engine directly into OpenAgent. Enables external intelligence
(Instinct / Jarvis) to:
- Scrape dynamic web pages into clean, LLM-ready Markdown in a single shot
- Perform web searches that return full Markdown contents from top results
- Crawl entire domains or doc trees recursively in the background
- Discover all URLs across a website (sitemap / mapping)
- Extract structured data with schemas via local AI / Ollama
- Run compound Python web research bursts locally without physical browser disruption
"""

from __future__ import annotations

import json
import logging
import os
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional, Union
from urllib.parse import urlparse

logger = logging.getLogger("openagent.firecrawl_adapter")

PROHIBITED_FIRECRAWL_DOMAINS = {
    "web.whatsapp.com",
    "whatsapp.com",
    "api.whatsapp.com",
}


class FirecrawlError(Exception):
    """Raised when a Firecrawl operation fails."""
    pass


def _check_url_allowed(url: Optional[str]) -> None:
    """Ensure the target URL does not target WhatsApp communication endpoints."""
    if not url:
        return
    parsed = urlparse(url if "://" in url else f"http://{url}")
    host = (parsed.hostname or "").lower()
    for prohibited in PROHIBITED_FIRECRAWL_DOMAINS:
        if host == prohibited or host.endswith("." + prohibited):
            raise FirecrawlError(
                f"Targeting '{url}' is prohibited. WhatsApp domains are reserved to protect bridge communication."
            )


class FirecrawlAdapter:
    """High-level adapter wrapping self-hosted Firecrawl API for OpenAgent."""

    def __init__(
        self,
        api_url: Optional[str] = None,
        api_key: Optional[str] = None,
        timeout: Optional[float] = None,
    ):
        self.api_url = (api_url or os.getenv("FIRECRAWL_API_URL") or "http://localhost:3002").rstrip("/")
        self.api_key = api_key if api_key is not None else os.getenv("FIRECRAWL_API_KEY", "")
        self.timeout = float(timeout or os.getenv("FIRECRAWL_TIMEOUT") or 60.0)

    def _request(
        self,
        method: str,
        path: str,
        payload: Optional[Dict[str, Any]] = None,
        timeout: Optional[float] = None,
    ) -> Dict[str, Any]:
        """Perform an HTTP request against the Firecrawl REST API."""
        url = f"{self.api_url}/{path.lstrip('/')}"
        data = None
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "OpenAgent-FirecrawlAdapter/1.0",
        }
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        if payload is not None:
            data = json.dumps(payload).encode("utf-8")

        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        eff_timeout = timeout if timeout is not None else self.timeout

        try:
            with urllib.request.urlopen(req, timeout=eff_timeout) as resp:
                status_code = resp.getcode()
                raw = resp.read().decode("utf-8")
                if not raw.strip():
                    return {"status": "ok", "http_status": status_code}
                try:
                    parsed = json.loads(raw)
                    return parsed if isinstance(parsed, dict) else {"data": parsed}
                except Exception:
                    return {"status": "ok", "raw": raw, "http_status": status_code}
        except urllib.error.HTTPError as err:
            body = err.read().decode("utf-8", errors="replace")
            err_msg = f"HTTP {err.code}: {err.reason}"
            try:
                err_json = json.loads(body)
                if isinstance(err_json, dict) and "error" in err_json:
                    err_msg = f"{err_msg} - {err_json['error']}"
            except Exception:
                if body.strip():
                    err_msg = f"{err_msg} - {body[:200]}"
            raise FirecrawlError(f"Firecrawl API error: {err_msg}") from err
        except urllib.error.URLError as err:
            raise FirecrawlError(
                f"Failed to connect to self-hosted Firecrawl at {self.api_url}. "
                "Ensure Firecrawl Docker services are running: "
                "docker compose -f src/tools/firecrawl/docker-compose.yaml up -d"
            ) from err
        except Exception as exc:
            raise FirecrawlError(f"Firecrawl request failed: {exc}") from exc

    # -----------------------------------------------------------------------
    # Core Scrape Primitive
    # -----------------------------------------------------------------------
    def scrape(
        self,
        url: str,
        formats: Optional[List[str]] = None,
        only_main_content: bool = True,
        wait_for: Optional[int] = None,
        timeout: Optional[int] = None,
        include_tags: Optional[List[str]] = None,
        exclude_tags: Optional[List[str]] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """Scrape a single URL into clean Markdown, HTML, screenshot, or metadata.

        Args:
            url: Target web page URL.
            formats: List of formats to return (default: ['markdown']). Options: 'markdown', 'html', 'rawHtml', 'screenshot'.
            only_main_content: Only return main page content (strip nav, footer, ads). Default True.
            wait_for: Delay in milliseconds before extracting content.
            timeout: Scrape timeout in milliseconds.
            include_tags: Specific HTML tags/selectors to include.
            exclude_tags: Specific HTML tags/selectors to remove.
            headers: Custom request headers to send to the target URL.
        """
        _check_url_allowed(url)
        formats = formats or ["markdown"]

        payload: Dict[str, Any] = {
            "url": url,
            "formats": formats,
            "onlyMainContent": only_main_content,
        }
        if wait_for is not None:
            payload["waitFor"] = int(wait_for)
        if timeout is not None:
            payload["timeout"] = int(timeout)
        if include_tags:
            payload["includeTags"] = include_tags
        if exclude_tags:
            payload["excludeTags"] = exclude_tags
        if headers:
            payload["headers"] = headers

        res = self._request("POST", "/v1/scrape", payload=payload)
        return res

    # -----------------------------------------------------------------------
    # Search Primitive (Web Search + In-Place Markdown Extraction)
    # -----------------------------------------------------------------------
    def search(
        self,
        query: str,
        limit: int = 5,
        scrape_options: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Search the web and extract full Markdown content from top hits.

        Args:
            query: Search query string.
            limit: Maximum number of search results to retrieve (default 5).
            scrape_options: Options for scraping the results (default: formats=['markdown']).
        """
        if not query or not str(query).strip():
            raise ValueError("Missing search query")

        payload: Dict[str, Any] = {
            "query": str(query).strip(),
            "limit": int(limit),
        }
        if scrape_options is not None:
            payload["scrapeOptions"] = scrape_options
        else:
            payload["scrapeOptions"] = {"formats": ["markdown"], "onlyMainContent": True}

        res = self._request("POST", "/v1/search", payload=payload)
        return res

    # -----------------------------------------------------------------------
    # Crawl Primitive (Recursive Domain Ingestion)
    # -----------------------------------------------------------------------
    def crawl(
        self,
        url: str,
        max_depth: int = 2,
        limit: int = 10,
        allow_backward_links: bool = False,
        allow_external_links: bool = False,
        scrape_options: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Initiate an asynchronous recursive crawl of a website.

        Args:
            url: Starting root URL for the crawl.
            max_depth: Maximum recursion link depth (default 2).
            limit: Maximum number of pages to crawl (default 10).
            allow_backward_links: Allow crawling parent directory links (default False).
            allow_external_links: Allow crawling external domains (default False).
            scrape_options: Scrape options applied to each crawled page.
        """
        _check_url_allowed(url)

        payload: Dict[str, Any] = {
            "url": url,
            "maxDepth": int(max_depth),
            "limit": int(limit),
            "allowBackwardLinks": bool(allow_backward_links),
            "allowExternalLinks": bool(allow_external_links),
        }
        if scrape_options is not None:
            payload["scrapeOptions"] = scrape_options
        else:
            payload["scrapeOptions"] = {"formats": ["markdown"], "onlyMainContent": True}

        res = self._request("POST", "/v1/crawl", payload=payload)
        return res

    def crawl_status(self, job_id: str) -> Dict[str, Any]:
        """Check status and retrieve results of an ongoing or completed crawl job.

        Args:
            job_id: The crawl ID returned by `crawl()`.
        """
        if not job_id:
            raise ValueError("Missing job_id argument")
        res = self._request("GET", f"/v1/crawl/{job_id}")
        return res

    def cancel_crawl(self, job_id: str) -> Dict[str, Any]:
        """Cancel an in-progress crawl job."""
        if not job_id:
            raise ValueError("Missing job_id argument")
        res = self._request("DELETE", f"/v1/crawl/{job_id}")
        return res

    # -----------------------------------------------------------------------
    # Map Primitive (Sitemap & Fast URL Discovery)
    # -----------------------------------------------------------------------
    def map(
        self,
        url: str,
        search: Optional[str] = None,
        limit: int = 100,
        ignore_sitemap: bool = False,
    ) -> Dict[str, Any]:
        """Discover all internal URLs on a domain without scraping page content.

        Args:
            url: Target domain or root URL.
            search: Optional substring or keyword filter to match discovered links.
            limit: Maximum links to return (default 100).
            ignore_sitemap: Skip robots.txt/sitemap.xml and find links by traversal.
        """
        _check_url_allowed(url)

        payload: Dict[str, Any] = {
            "url": url,
            "limit": int(limit),
            "ignoreSitemap": bool(ignore_sitemap),
        }
        if search:
            payload["search"] = str(search)

        res = self._request("POST", "/v1/map", payload=payload)
        return res

    # -----------------------------------------------------------------------
    # Extract Primitive (Structured Data Extraction via AI)
    # -----------------------------------------------------------------------
    def extract(
        self,
        urls: Union[str, List[str]],
        prompt: Optional[str] = None,
        schema: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Extract structured JSON data matching a schema or prompt from web pages.

        Args:
            urls: Single URL or list of URLs to extract data from.
            prompt: Text prompt describing the target data to extract.
            schema: Optional JSON Schema dictionary defining the expected output.
        """
        url_list = [urls] if isinstance(urls, str) else list(urls)
        for u in url_list:
            _check_url_allowed(u)

        payload: Dict[str, Any] = {
            "urls": url_list,
        }
        if prompt:
            payload["prompt"] = str(prompt)
        if schema:
            payload["schema"] = schema

        res = self._request("POST", "/v1/extract", payload=payload)
        return res

    # -----------------------------------------------------------------------
    # Diagnostics & Health Check
    # -----------------------------------------------------------------------
    def doctor(self) -> Dict[str, Any]:
        """Check the health and responsiveness of the local Firecrawl daemon."""
        result: Dict[str, Any] = {
            "api_url": self.api_url,
            "status": "unknown",
            "reachable": False,
        }
        try:
            # Test connectivity to root or health endpoint
            res = self._request("GET", "/test", timeout=5.0)
            result["status"] = "ok"
            result["reachable"] = True
            result["details"] = res
        except FirecrawlError as err:
            try:
                res = self._request("GET", "/", timeout=5.0)
                result["status"] = "ok"
                result["reachable"] = True
                result["details"] = res
            except Exception as inner_err:
                result["status"] = "error"
                result["error"] = str(err)
                result["inner_error"] = str(inner_err)
        return result


__all__ = [
    "FirecrawlAdapter",
    "FirecrawlError",
    "PROHIBITED_FIRECRAWL_DOMAINS",
]
