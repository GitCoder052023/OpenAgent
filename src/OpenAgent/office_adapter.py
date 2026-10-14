"""Native Enterprise Office Suite Adapter for OpenAgent.

Empowers Commercial Instinct over WhatsApp to inspect, generate, and edit:
- Word documents (.docx)
- Excel spreadsheets (.xlsx)
- PowerPoint slide decks (.pptx)
"""

import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

logger = logging.getLogger("openagent.office")

# Graceful optional imports
try:
    import docx
    from docx.shared import Inches, Pt, RGBColor
    HAS_DOCX = True
except ImportError:
    HAS_DOCX = False

try:
    import openpyxl
    from openpyxl.styles import Alignment, Font, PatternFill
    HAS_OPENPYXL = True
except ImportError:
    HAS_OPENPYXL = False

try:
    import pptx
    from pptx.util import Inches as PptxInches, Pt as PptxPt
    HAS_PPTX = True
except ImportError:
    HAS_PPTX = False


def resolve_output_path(path_str: str) -> Path:
    """Resolve relative file paths to ~/Documents for user predictability."""
    p = Path(path_str).expanduser()
    if p.is_absolute():
        p.parent.mkdir(parents=True, exist_ok=True)
        return p

    docs_dir = Path.home() / "Documents"
    docs_dir.mkdir(parents=True, exist_ok=True)
    target = docs_dir / path_str
    target.parent.mkdir(parents=True, exist_ok=True)
    return target


class OfficeAdapter:
    """Read, generate, and edit Office files (Word, Excel, PowerPoint)."""

    # -------------------------------------------------------------------------
    # Word (.docx)
    # -------------------------------------------------------------------------
    def word_read(self, path: str, max_paragraphs: int = 50) -> Dict[str, Any]:
        """Extract text, headers, and tables from a Word .docx document."""
        if not HAS_DOCX:
            return {"status": "error", "error": "python-docx is not installed"}

        target = Path(path).expanduser()
        if not target.exists():
            return {"status": "error", "error": f"File not found: {path}"}

        try:
            doc = docx.Document(str(target))
            paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
            preview = paragraphs[:max_paragraphs]

            tables_data = []
            for t_idx, table in enumerate(doc.tables[:5]):
                table_rows = []
                for row in table.rows:
                    table_rows.append([cell.text.strip() for cell in row.cells])
                tables_data.append({"table_index": t_idx + 1, "rows": table_rows})

            return {
                "status": "ok",
                "path": str(target),
                "total_paragraphs": len(paragraphs),
                "total_tables": len(doc.tables),
                "paragraphs": preview,
                "tables": tables_data,
                "text_summary": "\n\n".join(preview[:10]),
            }
        except Exception as exc:
            return {"status": "error", "error": f"Failed to read Word document: {exc}"}

    def word_write(
        self,
        path: str,
        title: str,
        paragraphs: List[Union[str, Dict[str, Any]]],
        tables: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """Create a Word .docx file with title, headings, body text, and tables."""
        if not HAS_DOCX:
            return {"status": "error", "error": "python-docx is not installed"}

        target = resolve_output_path(path)
        try:
            doc = docx.Document()
            # Title
            doc.add_heading(title, level=0)

            # Paragraphs
            for p in paragraphs:
                if isinstance(p, dict):
                    level = p.get("heading", 0)
                    text = p.get("text", "")
                    if level > 0:
                        doc.add_heading(text, level=min(level, 3))
                    elif p.get("bullet"):
                        doc.add_paragraph(text, style="List Bullet")
                    else:
                        doc.add_paragraph(text)
                else:
                    doc.add_paragraph(str(p))

            # Tables
            if tables:
                for t in tables:
                    headers = t.get("headers", [])
                    rows = t.get("rows", [])
                    if headers or rows:
                        cols = len(headers) if headers else (len(rows[0]) if rows else 0)
                        if cols > 0:
                            tbl = doc.add_table(rows=0, cols=cols)
                            tbl.style = "Table Grid"
                            if headers:
                                hdr_cells = tbl.add_row().cells
                                for i, h in enumerate(headers):
                                    hdr_cells[i].text = str(h)
                            for r in rows:
                                row_cells = tbl.add_row().cells
                                for i, val in enumerate(r[:cols]):
                                    row_cells[i].text = str(val)

            doc.save(str(target))
            return {
                "status": "ok",
                "path": str(target),
                "message": f"Successfully created Word document at {target}",
            }
        except Exception as exc:
            return {"status": "error", "error": f"Failed to create Word document: {exc}"}

    # -------------------------------------------------------------------------
    # Excel (.xlsx)
    # -------------------------------------------------------------------------
    def excel_read(self, path: str, sheet_name: Optional[str] = None, max_rows: int = 50) -> Dict[str, Any]:
        """Read structured tabular data from an Excel workbook."""
        if not HAS_OPENPYXL:
            return {"status": "error", "error": "openpyxl is not installed"}

        target = Path(path).expanduser()
        if not target.exists():
            return {"status": "error", "error": f"File not found: {path}"}

        try:
            wb = openpyxl.load_workbook(str(target), data_only=True)
            sheets = wb.sheetnames
            active_sheet = sheet_name if sheet_name and sheet_name in sheets else sheets[0]
            ws = wb[active_sheet]

            rows_data = []
            for r_idx, row in enumerate(ws.iter_rows(values_only=True)):
                if r_idx >= max_rows:
                    break
                if any(cell is not None for cell in row):
                    rows_data.append(list(row))

            headers = rows_data[0] if rows_data else []
            data_rows = rows_data[1:] if len(rows_data) > 1 else []

            return {
                "status": "ok",
                "path": str(target),
                "sheets": sheets,
                "active_sheet": active_sheet,
                "total_rows_read": len(rows_data),
                "headers": headers,
                "rows": data_rows,
            }
        except Exception as exc:
            return {"status": "error", "error": f"Failed to read Excel workbook: {exc}"}

    def excel_write(
        self,
        path: str,
        sheet_name: str = "Sheet1",
        headers: Optional[List[Any]] = None,
        rows: Optional[List[List[Any]]] = None,
    ) -> Dict[str, Any]:
        """Create or update an Excel .xlsx workbook."""
        if not HAS_OPENPYXL:
            return {"status": "error", "error": "openpyxl is not installed"}

        target = resolve_output_path(path)
        try:
            wb = openpyxl.Workbook()
            ws = wb.active
            ws.title = sheet_name

            # Write headers
            if headers:
                ws.append([str(h) for h in headers])
                header_fill = PatternFill(start_color="1F497D", end_color="1F497D", fill_type="solid")
                header_font = Font(color="FFFFFF", bold=True)
                for cell in ws[1]:
                    cell.fill = header_fill
                    cell.font = header_font
                    cell.alignment = Alignment(horizontal="center")

            # Write rows
            if rows:
                for r in rows:
                    ws.append(r)

            # Auto-adjust column widths
            for col in ws.columns:
                max_len = max(len(str(cell.value or "")) for cell in col)
                col_letter = col[0].column_letter
                ws.column_dimensions[col_letter].width = max(max_len + 3, 12)

            wb.save(str(target))
            return {
                "status": "ok",
                "path": str(target),
                "message": f"Successfully created Excel spreadsheet at {target}",
            }
        except Exception as exc:
            return {"status": "error", "error": f"Failed to write Excel workbook: {exc}"}

    # -------------------------------------------------------------------------
    # PowerPoint (.pptx)
    # -------------------------------------------------------------------------
    def pptx_read(self, path: str, max_slides: int = 25) -> Dict[str, Any]:
        """Inspect slide titles, bullet points, and notes from a .pptx presentation."""
        if not HAS_PPTX:
            return {"status": "error", "error": "python-pptx is not installed"}

        target = Path(path).expanduser()
        if not target.exists():
            return {"status": "error", "error": f"File not found: {path}"}

        try:
            prs = pptx.Presentation(str(target))
            slides_data = []
            for idx, slide in enumerate(prs.slides):
                if idx >= max_slides:
                    break
                title = slide.shapes.title.text if slide.shapes.title else f"Slide {idx + 1}"
                texts = []
                for shape in slide.shapes:
                    if shape.has_text_frame and shape != slide.shapes.title:
                        for p in shape.text_frame.paragraphs:
                            t = p.text.strip()
                            if t:
                                texts.append(t)
                slides_data.append({
                    "slide_number": idx + 1,
                    "title": title,
                    "bullets": texts,
                })

            return {
                "status": "ok",
                "path": str(target),
                "total_slides": len(prs.slides),
                "slides": slides_data,
            }
        except Exception as exc:
            return {"status": "error", "error": f"Failed to read PowerPoint deck: {exc}"}

    def pptx_write(
        self,
        path: str,
        title: str,
        slides: List[Dict[str, Any]],
        subtitle: str = "Prepared by OpenAgent",
    ) -> Dict[str, Any]:
        """Create a PowerPoint .pptx deck with a title slide and content slides."""
        if not HAS_PPTX:
            return {"status": "error", "error": "python-pptx is not installed"}

        target = resolve_output_path(path)
        try:
            prs = pptx.Presentation()

            # 1. Title Slide
            title_slide_layout = prs.slide_layouts[0]
            slide = prs.slides.add_slide(title_slide_layout)
            slide.shapes.title.text = title
            if len(slide.placeholders) > 1:
                slide.placeholders[1].text = subtitle

            # 2. Content Slides
            bullet_slide_layout = prs.slide_layouts[1]
            for s in slides:
                s_title = s.get("title", "Topic")
                bullets = s.get("bullets", [])
                c_slide = prs.slides.add_slide(bullet_slide_layout)
                c_slide.shapes.title.text = s_title
                body_shape = c_slide.shapes.placeholders[1]
                tf = body_shape.text_frame
                tf.clear()

                for b_idx, bullet in enumerate(bullets):
                    if b_idx == 0:
                        tf.paragraphs[0].text = str(bullet)
                    else:
                        p = tf.add_paragraph()
                        p.text = str(bullet)
                        p.level = 0

            prs.save(str(target))
            return {
                "status": "ok",
                "path": str(target),
                "total_slides": len(prs.slides),
                "message": f"Successfully created PowerPoint presentation at {target}",
            }
        except Exception as exc:
            return {"status": "error", "error": f"Failed to write PowerPoint deck: {exc}"}

    def pptx_template_fill(
        self,
        template_path: str,
        output_path: str,
        replacements: Dict[str, str],
    ) -> Dict[str, Any]:
        """Fill template placeholder tags (e.g. {{TITLE}}, {{DATE}}) in an existing .pptx deck."""
        if not HAS_PPTX:
            return {"status": "error", "error": "python-pptx is not installed"}

        src = Path(template_path).expanduser()
        if not src.exists():
            return {"status": "error", "error": f"Template file not found: {template_path}"}

        dest = resolve_output_path(output_path)
        try:
            prs = pptx.Presentation(str(src))
            replaced_count = 0

            for slide in prs.slides:
                for shape in slide.shapes:
                    if shape.has_text_frame:
                        for paragraph in shape.text_frame.paragraphs:
                            for key, val in replacements.items():
                                tag = f"{{{{{key}}}}}" if not key.startswith("{{") else key
                                if tag in paragraph.text:
                                    paragraph.text = paragraph.text.replace(tag, str(val))
                                    replaced_count += 1

            prs.save(str(dest))
            return {
                "status": "ok",
                "template": str(src),
                "output": str(dest),
                "replacements_applied": replaced_count,
            }
        except Exception as exc:
            return {"status": "error", "error": f"Failed to fill PowerPoint template: {exc}"}


_DEFAULT_OFFICE_ADAPTER: Optional[OfficeAdapter] = None


def get_default_office_adapter() -> OfficeAdapter:
    global _DEFAULT_OFFICE_ADAPTER
    if _DEFAULT_OFFICE_ADAPTER is None:
        _DEFAULT_OFFICE_ADAPTER = OfficeAdapter()
    return _DEFAULT_OFFICE_ADAPTER
