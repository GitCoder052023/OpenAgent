"""Universal Model Context Protocol (MCP) Client Adapter for OpenAgent.

Modeled after openagent/mcp.
Enables Commercial Instinct to dynamically discover and execute tools from any
local or remote MCP server (Stdio, SSE, or StreamableHTTP) configured in .openagent/mcp.json.

Protocol Standard: https://modelcontextprotocol.io
"""

import json
import logging
import os
import subprocess
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("openagent.mcp")


class McpServerClient:
    """Manages connection and tool calling for a single configured MCP server."""

    def __init__(self, name: str, config: Dict[str, Any]):
        self.name = name
        self.config = config
        self.transport = config.get("transport") or ("stdio" if "command" in config else "http")
        self._tools_cache: Optional[List[Dict[str, Any]]] = None

    def _call_http(self, method: str, params: Optional[Dict[str, Any]] = None, timeout: float = 25.0) -> Dict[str, Any]:
        url = self.config.get("url")
        if not url:
            return {"status": "error", "error": f"Missing 'url' for MCP server {self.name}"}

        headers = {"Content-Type": "application/json"}
        token = self.config.get("token") or self.config.get("apiKey")
        if token:
            headers["Authorization"] = f"Bearer {token}"

        payload = {
            "jsonrpc": "2.0",
            "id": int(time.time() * 1000),
            "method": method,
            "params": params or {},
        }
        try:
            req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            if "error" in data:
                return {"status": "error", "error": data["error"]}
            return {"status": "ok", "result": data.get("result", {})}
        except Exception as exc:
            return {"status": "error", "error": f"MCP HTTP call failed on {self.name}: {exc}"}

    def _call_stdio(self, tool_name: str, arguments: Dict[str, Any], timeout: float = 30.0) -> Dict[str, Any]:
        cmd = self.config.get("command")
        args = self.config.get("args", [])
        if not cmd:
            return {"status": "error", "error": f"Missing 'command' for MCP server {self.name}"}

        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/call",
            "params": {"name": tool_name, "arguments": arguments},
        }

        env = os.environ.copy()
        if "env" in self.config and isinstance(self.config["env"], dict):
            env.update({str(k): str(v) for k, v in self.config["env"].items()})

        try:
            p = subprocess.Popen(
                [cmd] + list(args),
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                env=env,
            )
            # Write JSON-RPC initialize first if needed, or direct call
            init_msg = json.dumps({"jsonrpc": "2.0", "id": 0, "method": "initialize", "params": {"protocolVersion": "2024-11-05", "capabilities": {}, "clientInfo": {"name": "OpenAgent", "version": "1.0"}}}) + "\n"
            call_msg = json.dumps(payload) + "\n"
            stdout, stderr = p.communicate(input=init_msg + call_msg, timeout=timeout)

            # Find matching response line
            for line in stdout.splitlines():
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                    if obj.get("id") == 1:
                        if "error" in obj:
                            return {"status": "error", "error": obj["error"]}
                        return {"status": "ok", "result": obj.get("result", {})}
                except Exception:
                    continue

            return {"status": "error", "error": f"No valid JSON-RPC result from {self.name}: {stderr or stdout}"}
        except subprocess.TimeoutExpired:
            return {"status": "error", "error": f"MCP command {cmd} timed out after {timeout}s"}
        except Exception as exc:
            return {"status": "error", "error": f"Failed to execute MCP stdio process: {exc}"}

    def list_tools(self) -> List[Dict[str, Any]]:
        """List tools provided by this server."""
        if self._tools_cache is not None:
            return self._tools_cache

        if self.transport == "http":
            res = self._call_http("tools/list")
            if res.get("status") == "ok":
                self._tools_cache = res.get("result", {}).get("tools", [])
                return self._tools_cache or []
        # If manually specified in config
        if "tools" in self.config and isinstance(self.config["tools"], list):
            self._tools_cache = self.config["tools"]
            return self._tools_cache or []

        return []

    def call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Call a specific tool on this MCP server."""
        if self.transport == "http":
            return self._call_http("tools/call", {"name": tool_name, "arguments": arguments})
        else:
            return self._call_stdio(tool_name, arguments)


class McpAdapter:
    """Dispatches tool calls across all configured MCP servers."""

    def __init__(self, config_file: Optional[Path] = None):
        self._lock = threading.Lock()
        self._config_file = config_file or self._resolve_config_file()
        self._servers: Dict[str, McpServerClient] = {}
        self._load()

    def _resolve_config_file(self) -> Path:
        local_p = Path.cwd() / ".openagent" / "mcp.json"
        if local_p.exists():
            return local_p
        user_p = Path.home() / ".openagent" / "mcp.json"
        return user_p

    def _load(self) -> None:
        if not self._config_file.exists():
            return
        try:
            with open(self._config_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            servers_dict = data.get("mcpServers") or data.get("servers") or data
            if isinstance(servers_dict, dict):
                for name, cfg in servers_dict.items():
                    if isinstance(cfg, dict):
                        self._servers[name] = McpServerClient(name, cfg)
        except Exception as exc:
            logger.warning("Could not load MCP config from %s: %s", self._config_file, exc)

    def list_all_tools(self) -> List[Dict[str, Any]]:
        """Return all tools across all configured MCP servers."""
        with self._lock:
            all_tools = []
            for s_name, client in self._servers.items():
                tools = client.list_tools()
                for t in tools:
                    t_copy = dict(t)
                    t_copy["server"] = s_name
                    all_tools.append(t_copy)
            return all_tools

    def call_tool(self, server_name: str, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """Route tool invocation to the specified MCP server."""
        with self._lock:
            client = self._servers.get(server_name)
            if not client:
                # If server_name not provided or unknown, check if tool exists in any server
                for s_name, c in self._servers.items():
                    for t in c.list_tools():
                        if t.get("name") == tool_name:
                            client = c
                            break
                    if client:
                        break

            if not client:
                return {
                    "status": "error",
                    "error": f"MCP server '{server_name}' is not configured in {self._config_file.name}",
                }

            return client.call_tool(tool_name, arguments)


_DEFAULT_MCP_ADAPTER: Optional[McpAdapter] = None


def get_default_mcp_adapter() -> McpAdapter:
    global _DEFAULT_MCP_ADAPTER
    if _DEFAULT_MCP_ADAPTER is None:
        _DEFAULT_MCP_ADAPTER = McpAdapter()
    return _DEFAULT_MCP_ADAPTER
