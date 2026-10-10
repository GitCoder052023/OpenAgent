"""End-to-End integration tests for Commercial Instinct tool dispatching over WhatsApp."""
import json
import tempfile
from pathlib import Path
from OpenAgent.dispatcher import (
    execute_tool_call,
    format_tool_response,
    format_tool_responses,
    encode_tool_call,
    parse_tool_calls,
)
from OpenAgent.guard import GuardEngine, EFFECT_ASK, EFFECT_DENY


def test_instinct_envelope_encoding_and_parsing():
    original_call = {"tool": "word_write", "args": {"title": "Doc", "paragraphs": ["Hello"]}}
    envelope_str = encode_tool_call(original_call)
    assert envelope_str.startswith("JARVIS_CALL:")
    assert envelope_str.endswith(":END")

    parsed = parse_tool_calls(envelope_str)
    assert len(parsed) == 1
    assert parsed[0]["tool"] == "word_write"
    assert parsed[0]["args"]["title"] == "Doc"


def test_instinct_guard_intercepts_sensitive_ssh():
    call = {"tool": "read", "args": {"path": "~/.ssh/id_rsa"}}
    res = execute_tool_call(None, call)
    assert res["status"] == "error"
    assert res.get("blocked") is True
    assert "restricted" in res["error"].lower() or "blocked" in res["error"].lower()

    formatted = format_tool_response(res)
    assert "⛔" in formatted or "blocked" in formatted.lower() or "error" in formatted.lower()


def test_instinct_guard_ask_and_confirm_flow():
    # 1. Dispatch dangerous command that triggers ASK
    call = {"tool": "bash", "args": {"command": "git push origin main --force"}}
    res = execute_tool_call(None, call)
    assert res["status"] == "ask"
    token = res.get("token")
    assert token is not None

    formatted = format_tool_response(res)
    assert "CONFIRM" in formatted
    assert token in formatted

    # 2. User confirms with token
    confirm_call = {"tool": "confirm", "args": {"token": token}}
    confirm_res = execute_tool_call(None, confirm_call)
    assert confirm_res["status"] == "ok"
    assert confirm_res["result"]["approved_action"] == "bash"


def test_instinct_office_word_dispatch():
    with tempfile.TemporaryDirectory() as tmpdir:
        doc_path = str(Path(tmpdir) / "instinct_brief.docx")
        call = {
            "tool": "word_write",
            "args": {
                "path": doc_path,
                "title": "Jarvis Morning Briefing",
                "paragraphs": ["Calendar is clear until 2 PM.", "Review GitHub pull requests."],
            },
        }
        res = execute_tool_call(None, call)
        assert res["status"] == "ok"
        assert Path(doc_path).exists()

        formatted = format_tool_response(res)
        assert "Word document created" in formatted or doc_path in formatted


def test_instinct_skills_catalog_dispatch():
    call = {"tool": "skills_list", "args": {}}
    res = execute_tool_call(None, call)
    assert res["status"] == "ok"
    assert "skills" in res["result"]
    assert res["result"]["total"] >= 10


def test_instinct_experience_recording():
    call = {
        "tool": "record_experience",
        "args": {
            "question": "Build project",
            "wrong_action": "Used yarn",
            "correction": "Use bun instead",
            "rule": "Never use yarn; always use bun for building OpenAgent",
            "category": "Fact",
        },
    }
    res = execute_tool_call(None, call)
    assert res["status"] == "ok"
    assert "rule" in res["result"]

    formatted = format_tool_response(res)
    assert "🧠" in formatted
    assert "Never use yarn" in formatted


def test_whatsapp_length_truncation():
    huge_text = "A" * 6000
    res = {"status": "ok", "tool": "test", "result": {"data": huge_text}}
    formatted = format_tool_response(res, max_length=2000)
    assert len(formatted) <= 2000
    assert "Output truncated" in formatted
