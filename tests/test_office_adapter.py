"""Unit tests for OpenAgent Office Suite Adapter."""
import tempfile
from pathlib import Path
from OpenAgent.office_adapter import OfficeAdapter


def test_office_word_write_and_read():
    adapter = OfficeAdapter()
    with tempfile.TemporaryDirectory() as tmpdir:
        doc_path = str(Path(tmpdir) / "test_doc.docx")
        write_res = adapter.word_write(
            path=doc_path,
            title="Q3 Strategy Report",
            paragraphs=[
                {"heading": 1, "text": "Executive Summary"},
                {"text": "Revenue grew by 24% year over year.", "bullet": True},
                "Next milestone is scheduled for November.",
            ],
            tables=[
                {
                    "headers": ["Department", "Budget", "Spent"],
                    "rows": [["Engineering", "$100k", "$82k"], ["Marketing", "$50k", "$45k"]],
                }
            ],
        )
        assert write_res["status"] == "ok"
        assert Path(doc_path).exists()

        read_res = adapter.word_read(doc_path)
        assert read_res["status"] == "ok"
        assert read_res["total_paragraphs"] >= 3
        assert read_res["total_tables"] == 1
        assert any("Revenue grew" in p for p in read_res["paragraphs"])


def test_office_excel_write_and_read():
    adapter = OfficeAdapter()
    with tempfile.TemporaryDirectory() as tmpdir:
        xlsx_path = str(Path(tmpdir) / "financials.xlsx")
        write_res = adapter.excel_write(
            path=xlsx_path,
            sheet_name="Q3Metrics",
            headers=["Quarter", "Revenue", "ARR"],
            rows=[["Q1", 120000, 480000], ["Q2", 150000, 600000], ["Q3", 190000, 760000]],
        )
        assert write_res["status"] == "ok"
        assert Path(xlsx_path).exists()

        read_res = adapter.excel_read(xlsx_path, sheet_name="Q3Metrics")
        assert read_res["status"] == "ok"
        assert read_res["headers"] == ["Quarter", "Revenue", "ARR"]
        assert len(read_res["rows"]) == 3
        assert read_res["rows"][0][0] == "Q1"


def test_office_pptx_write_and_read():
    adapter = OfficeAdapter()
    with tempfile.TemporaryDirectory() as tmpdir:
        pptx_path = str(Path(tmpdir) / "pitch.pptx")
        write_res = adapter.pptx_write(
            path=pptx_path,
            title="OpenAgent Product Keynote",
            subtitle="The Sovereign Mac Body",
            slides=[
                {
                    "title": "Architecture Overview",
                    "bullets": ["Zero latency local IPC", "5 native harnesses", "WhatsApp & voice integration"],
                },
                {
                    "title": "Key Metrics",
                    "bullets": ["195 unit tests", "Sub-50ms execution", "100% private memory"],
                },
            ],
        )
        assert write_res["status"] == "ok"
        assert Path(pptx_path).exists()

        read_res = adapter.pptx_read(pptx_path)
        assert read_res["status"] == "ok"
        assert read_res["total_slides"] == 3  # 1 title slide + 2 content slides
        assert read_res["slides"][1]["title"] == "Architecture Overview"
        assert "Zero latency local IPC" in read_res["slides"][1]["bullets"][0]
