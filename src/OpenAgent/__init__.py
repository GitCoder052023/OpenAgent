"""OpenAgent: Local, sovereign Mac execution body & bridge for Commercial Instinct."""
from .firecrawl_adapter import FirecrawlAdapter, FirecrawlError
from .skills_adapter import SkillsAdapter, get_default_skills_adapter
from .office_adapter import OfficeAdapter, get_default_office_adapter
from .wacli_adapter import WacliAdapter, get_default_wacli_adapter
from .mcp_adapter import McpAdapter, get_default_mcp_adapter

__all__ = [
    "FirecrawlAdapter",
    "FirecrawlError",
    "SkillsAdapter",
    "get_default_skills_adapter",
    "OfficeAdapter",
    "get_default_office_adapter",
    "WacliAdapter",
    "get_default_wacli_adapter",
    "McpAdapter",
    "get_default_mcp_adapter",
]
