"""Unit tests for Universal Model Context Protocol (MCP) Adapter."""
import json
import tempfile
from pathlib import Path
from OpenAgent.mcp_adapter import McpAdapter, get_default_mcp_adapter


def test_mcp_adapter_empty_config():
    with tempfile.TemporaryDirectory() as tmpdir:
        cfg_file = Path(tmpdir) / "mcp.json"
        adapter = McpAdapter(config_file=cfg_file)
        tools = adapter.list_all_tools()
        assert tools == []

        res = adapter.call_tool("unknown_server", "test_tool", {})
        assert res["status"] == "error"
        assert "not configured" in res["error"]


def test_mcp_adapter_with_configured_server():
    with tempfile.TemporaryDirectory() as tmpdir:
        cfg_file = Path(tmpdir) / "mcp.json"
        cfg_file.write_text(
            json.dumps({
                "mcpServers": {
                    "demo": {
                        "transport": "stdio",
                        "command": "echo",
                        "args": [],
                        "tools": [
                            {"name": "demo_echo", "description": "Echo input"}
                        ],
                    }
                }
            }),
            encoding="utf-8",
        )
        adapter = McpAdapter(config_file=cfg_file)
        tools = adapter.list_all_tools()
        assert len(tools) == 1
        assert tools[0]["name"] == "demo_echo"
        assert tools[0]["server"] == "demo"


def test_get_default_mcp_adapter():
    a1 = get_default_mcp_adapter()
    a2 = get_default_mcp_adapter()
    assert a1 is a2
