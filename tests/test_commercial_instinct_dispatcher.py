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


def test_instinct_envelope_encoding_and_parsing():
    original_call = {"tool": "word_write", "args": {"title": "Doc", "paragraphs": ["Hello"]}}
    envelope_str = encode_tool_call(original_call)
    assert envelope_str.startswith("JARVIS_CALL:")
    assert envelope_str.endswith(":END")

    parsed = parse_tool_calls(envelope_str)
    assert len(parsed) == 1
    assert parsed[0]["tool"] == "word_write"
    assert parsed[0]["args"]["title"] == "Doc"


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


def test_instinct_office_excel_dispatch():
    with tempfile.TemporaryDirectory() as tmpdir:
        xlsx_path = str(Path(tmpdir) / "metrics.xlsx")
        call = {
            "tool": "excel_write",
            "args": {
                "path": xlsx_path,
                "sheet_name": "KPIs",
                "headers": ["Metric", "Value"],
                "rows": [["NPS", 82], ["Uptime", "99.99%"]],
            },
        }
        res = execute_tool_call(None, call)
        assert res["status"] == "ok"
        assert Path(xlsx_path).exists()


def test_instinct_office_pptx_dispatch():
    with tempfile.TemporaryDirectory() as tmpdir:
        pptx_path = str(Path(tmpdir) / "deck.pptx")
        call = {
            "tool": "pptx_write",
            "args": {
                "path": pptx_path,
                "title": "Quarterly Deck",
                "slides": [{"title": "Slide 1", "bullets": ["Point A", "Point B"]}],
            },
        }
        res = execute_tool_call(None, call)
        assert res["status"] == "ok"
        assert Path(pptx_path).exists()


def test_instinct_skills_catalog_dispatch():
    call = {"tool": "skills_list", "args": {}}
    res = execute_tool_call(None, call)
    assert res["status"] == "ok"
    assert "skills" in res["result"]
    assert res["result"]["total"] >= 10


def test_instinct_wacli_dispatch():
    call = {"tool": "wacli_status", "args": {}}
    res = execute_tool_call(None, call)
    assert "status" in res
    assert res["tool"] == "wacli_status"


def test_instinct_mcp_dispatch():
    call = {"tool": "mcp_list", "args": {}}
    res = execute_tool_call(None, call)
    assert res["status"] == "ok"
    assert "mcp_tools" in res["result"]


def test_whatsapp_length_truncation():
    huge_text = "A" * 6000
    res = {"status": "ok", "tool": "test", "result": {"data": huge_text}}
    formatted = format_tool_response(res, max_length=2000)
    assert len(formatted) <= 2000
    assert "Output truncated" in formatted
