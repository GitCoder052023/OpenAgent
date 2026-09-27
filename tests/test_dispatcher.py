import pytest
from unittest.mock import MagicMock
from bridge.dispatcher import (
    parse_tool_call,
    parse_tool_calls,
    execute_tool_call,
    format_tool_response,
    format_tool_responses,
    MAX_WHATSAPP_RESPONSE_LEN,
)
from bridge.harness import OpenCodeHarness, HarnessError


def test_parse_tool_call_markdown_fenced():
    msg = """Sure, let me check the git status:
```json
{
  "tool": "bash",
  "args": {
    "command": "git status"
  }
}
```
Let me know if you need more."""
    call = parse_tool_call(msg)
    assert call is not None
    assert call["tool"] == "bash"
    assert call["args"] == {"command": "git status"}


def test_parse_tool_call_xml_tags():
    msg = "<tool_call>{\"tool\": \"applescript\", \"args\": {\"script\": \"beep\"}}</tool_call>"
    call = parse_tool_call(msg)
    assert call is not None
    assert call["tool"] == "applescript"
    assert call["args"] == {"script": "beep"}


def test_parse_tool_call_raw_json():
    msg = '{"tool": "read", "args": {"path": "package.json"}}'
    call = parse_tool_call(msg)
    assert call is not None
    assert call["tool"] == "read"
    assert call["args"] == {"path": "package.json"}


def test_parse_tool_call_nested_json_in_args():
    msg = r"""```json
{
  "tool": "bash",
  "args": {
    "command": "echo '{\"nested\": true}'"
  }
}
```"""
    call = parse_tool_call(msg)
    assert call is not None
    assert call["tool"] == "bash"
    assert call["args"]["command"] == "echo '{\"nested\": true}'"


def test_parse_tool_call_openai_format():
    msg = '{"function": {"name": "grep", "arguments": "{\\"pattern\\": \\"def test\\", \\"path\\": \\"tests\\"}"}}'
    call = parse_tool_call(msg)
    assert call is not None
    assert call["tool"] == "grep"
    assert call["args"] == {"pattern": "def test", "path": "tests"}


def test_parse_tool_call_python_literal():
    msg = "{'tool': 'glob', 'args': {'pattern': '*.ts'}}"
    call = parse_tool_call(msg)
    assert call is not None
    assert call["tool"] == "glob"
    assert call["args"] == {"pattern": "*.ts"}


def test_parse_multiple_tool_calls_array():
    msg = """```json
[
  {"tool": "bash", "args": {"command": "pwd"}},
  {"tool": "read", "args": {"path": "config.py"}}
]
```"""
    calls = parse_tool_calls(msg)
    assert len(calls) == 2
    assert calls[0]["tool"] == "bash"
    assert calls[0]["args"] == {"command": "pwd"}
    assert calls[1]["tool"] == "read"
    assert calls[1]["args"] == {"path": "config.py"}


def test_parse_multiple_tool_calls_multiple_blocks():
    msg = """First do this:
<tool_call>{"tool": "write", "args": {"path": "hello.txt", "content": "hi"}}</tool_call>
Then do this:
<tool_call>{"tool": "bash", "args": {"command": "cat hello.txt"}}</tool_call>"""
    calls = parse_tool_calls(msg)
    assert len(calls) == 2
    assert calls[0]["tool"] == "write"
    assert calls[1]["tool"] == "bash"


def test_parse_non_tool_text_returns_empty():
    assert parse_tool_call("Hey Jarvis, how is the weather today?") is None
    assert parse_tool_calls("Just a regular chat message without any tools.") == []
    assert parse_tool_call("") is None


def test_execute_tool_call_bash():
    mock_harness = MagicMock(spec=OpenCodeHarness)
    mock_harness.bash.return_value = {"exit_code": 0, "output": "file1\nfile2\n", "timed_out": False}

    res = execute_tool_call(mock_harness, {"tool": "bash", "args": {"command": "ls"}})
    assert res["status"] == "ok"
    assert res["tool"] == "bash"
    assert res["result"]["exit_code"] == 0
    mock_harness.bash.assert_called_once_with(command="ls", cwd=None, timeout_ms=60000)


def test_execute_tool_call_read():
    mock_harness = MagicMock(spec=OpenCodeHarness)
    mock_harness.read.return_value = {"path": "a.txt", "content": "hello", "lines_returned": 1}

    res = execute_tool_call(mock_harness, {"tool": "read", "args": {"path": "a.txt", "offset": 1, "limit": 10}})
    assert res["status"] == "ok"
    assert res["result"]["content"] == "hello"
    mock_harness.read.assert_called_once_with(path="a.txt", offset=1, limit=10)


def test_execute_tool_call_write_and_edit():
    mock_harness = MagicMock(spec=OpenCodeHarness)
    mock_harness.write.return_value = {"path": "a.txt", "bytes_written": 5}
    mock_harness.edit.return_value = {"path": "a.txt", "replacements": 1, "diff": "-a\n+b"}

    res_write = execute_tool_call(mock_harness, {"tool": "write", "args": {"path": "a.txt", "content": "hello"}})
    assert res_write["status"] == "ok"

    res_edit = execute_tool_call(mock_harness, {"tool": "edit", "args": {"path": "a.txt", "old_string": "a", "new_string": "b"}})
    assert res_edit["status"] == "ok"
    mock_harness.edit.assert_called_once_with(path="a.txt", old_string="a", new_string="b", replace_all=False)


def test_execute_tool_call_applescript():
    mock_harness = MagicMock(spec=OpenCodeHarness)
    mock_harness.applescript.return_value = "Desk"

    res = execute_tool_call(mock_harness, {"tool": "applescript", "args": {"script": "return \"Desk\""}})
    assert res["status"] == "ok"
    assert res["result"]["output"] == "Desk"


def test_execute_tool_call_unknown_tool():
    mock_harness = MagicMock(spec=OpenCodeHarness)
    res = execute_tool_call(mock_harness, {"tool": "fly_to_moon", "args": {}})
    assert res["status"] == "error"
    assert "Unknown harness tool" in res["error"]


def test_execute_tool_call_missing_arg():
    mock_harness = MagicMock(spec=OpenCodeHarness)
    res = execute_tool_call(mock_harness, {"tool": "bash", "args": {}})
    assert res["status"] == "error"
    assert "Missing 'command'" in res["error"]


def test_execute_tool_call_harness_error():
    mock_harness = MagicMock(spec=OpenCodeHarness)
    mock_harness.bash.side_effect = HarnessError("Timeout occurred")

    res = execute_tool_call(mock_harness, {"tool": "bash", "args": {"command": "sleep 10"}})
    assert res["status"] == "error"
    assert "Timeout occurred" in res["error"]


def test_format_tool_response_bash():
    resp = {
        "status": "ok",
        "tool": "bash",
        "result": {"exit_code": 0, "output": "total 0\n", "timed_out": False},
    }
    formatted = format_tool_response(resp)
    assert "[Jarvis Tool Response: bash | status: ok]" in formatted
    assert "(exit 0)" in formatted
    assert "total 0" in formatted


def test_format_tool_response_error():
    resp = {
        "status": "error",
        "tool": "read",
        "error": "File not found: nonexistent.txt",
    }
    formatted = format_tool_response(resp)
    assert "[Jarvis Tool Response: read | status: error]" in formatted
    assert "Error: File not found: nonexistent.txt" in formatted


def test_format_tool_response_truncation():
    huge_output = "x" * 10000
    resp = {
        "status": "ok",
        "tool": "bash",
        "result": {"exit_code": 0, "output": huge_output, "timed_out": False},
    }
    formatted = format_tool_response(resp, max_length=1000)
    assert len(formatted) <= 1000
    assert "Output truncated" in formatted


def test_format_tool_responses_multiple():
    responses = [
        {"status": "ok", "tool": "bash", "result": {"exit_code": 0, "output": "step 1 done"}},
        {"status": "ok", "tool": "read", "result": {"path": "a.txt", "content": "step 2 content", "lines_returned": 1}},
    ]
    formatted = format_tool_responses(responses)
    assert "[Jarvis Tool Response 1/2: bash" in formatted
    assert "[Jarvis Tool Response 2/2: read" in formatted
