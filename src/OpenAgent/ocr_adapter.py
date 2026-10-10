"""Offline Document OCR & Text Extraction Adapter for OpenAgent.

Modeled after openagent/deploy/ocr-service and openagent/internal/localocr.
Provides fast, 100% offline OCR on scanned PDFs, receipts, images, and documents
using RapidOCR ONNX models and pypdfium2, with fallback to pypdf for text PDFs.
Zero cloud API keys required.
"""

import logging
import os
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("openagent.ocr")

try:
    import pypdfium2 as pdfium
    HAS_PDFIUM = True
except ImportError:
    HAS_PDFIUM = False

try:
    from rapidocr_onnxruntime import RapidOCR
    HAS_RAPID_OCR = True
except ImportError:
    HAS_RAPID_OCR = False

try:
    import pypdf
    HAS_PYPDF = True
except ImportError:
    HAS_PYPDF = False

try:
    from PIL import Image
    HAS_PIL = True
except ImportError:
    HAS_PIL = False

_OCR_ENGINE: Optional[Any] = None


def _get_ocr_engine():
    global _OCR_ENGINE
    if _OCR_ENGINE is None and HAS_RAPID_OCR:
        try:
            _OCR_ENGINE = RapidOCR()
        except Exception as exc:
            logger.warning("Could not initialize RapidOCR engine: %s", exc)
    return _OCR_ENGINE


class OCRAdapter:
    """Extracts text from scanned PDFs and images offline."""

    def ocr_image(self, path: str) -> Dict[str, Any]:
        """Run OCR on a single image file (PNG, JPG, TIFF, WebP)."""
        target = Path(path).expanduser()
        if not target.exists():
            return {"status": "error", "error": f"Image file not found: {path}"}

        engine = _get_ocr_engine()
        if not engine:
            return {
                "status": "error",
                "error": "RapidOCR is not available. Please install rapidocr-onnxruntime.",
            }

        try:
            result, elapse = engine(str(target))
            if not result:
                return {
                    "status": "ok",
                    "path": str(target),
                    "text": "",
                    "lines": [],
                    "message": "No text detected in image",
                }

            lines = [item[1] for item in result if len(item) > 1 and item[1]]
            full_text = "\n".join(lines)
            return {
                "status": "ok",
                "path": str(target),
                "text": full_text,
                "line_count": len(lines),
                "lines": lines,
            }
        except Exception as exc:
            return {"status": "error", "error": f"OCR failed on image: {exc}"}

    def ocr_pdf(self, path: str, max_pages: int = 10) -> Dict[str, Any]:
        """Extract text from a PDF document, running OCR on rasterized pages if scanned."""
        target = Path(path).expanduser()
        if not target.exists():
            return {"status": "error", "error": f"PDF file not found: {path}"}

        # 1. First attempt: standard digital text extraction via pypdf (fastest)
        if HAS_PYPDF:
            try:
                reader = pypdf.PdfReader(str(target))
                extracted_pages = []
                for p_idx, page in enumerate(reader.pages[:max_pages]):
                    p_text = page.extract_text() or ""
                    if p_text.strip():
                        extracted_pages.append((p_idx + 1, p_text.strip()))

                # If digital text exists for most pages, return it immediately
                if len(extracted_pages) >= max(1, min(len(reader.pages), max_pages) // 2):
                    combined = "\n\n".join(f"--- Page {p[0]} ---\n{p[1]}" for p in extracted_pages)
                    return {
                        "status": "ok",
                        "path": str(target),
                        "is_scanned": False,
                        "total_pages": len(reader.pages),
                        "pages_read": len(extracted_pages),
                        "text": combined,
                    }
            except Exception as exc:
                logger.debug("Digital PDF extraction failed, falling back to OCR: %s", exc)

        # 2. Scanned PDF fallback: render pages to bitmaps and run RapidOCR
        if not HAS_PDFIUM or not HAS_RAPID_OCR:
            return {
                "status": "error",
                "error": "OCR on scanned PDF requires pypdfium2 and rapidocr-onnxruntime.",
            }

        engine = _get_ocr_engine()
        if not engine:
            return {"status": "error", "error": "RapidOCR engine failed to initialize."}

        try:
            pdf = pdfium.PdfDocument(str(target))
            total_pages = len(pdf)
            page_results = []

            for p_idx in range(min(total_pages, max_pages)):
                page = pdf[p_idx]
                try:
                    bitmap = page.render(scale=2.0)
                    try:
                        pil_img = bitmap.to_pil().convert("RGB")
                        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
                            pil_img.save(tmp.name)
                            tmp_path = tmp.name

                        res, _ = engine(tmp_path)
                        try:
                            os.remove(tmp_path)
                        except OSError:
                            pass

                        if res:
                            p_lines = [item[1] for item in res if len(item) > 1 and item[1]]
                            page_text = "\n".join(p_lines)
                            page_results.append(f"--- Page {p_idx + 1} (OCR) ---\n{page_text}")
                    finally:
                        bitmap.close()
                finally:
                    pass

            pdf.close()
            combined = "\n\n".join(page_results)
            return {
                "status": "ok",
                "path": str(target),
                "is_scanned": True,
                "total_pages": total_pages,
                "pages_ocr": len(page_results),
                "text": combined,
            }
        except Exception as exc:
            return {"status": "error", "error": f"Failed to OCR PDF: {exc}"}

    def extract_document_text(self, path: str) -> Dict[str, Any]:
        """Automatically detect document format and return extracted text."""
        target = Path(path).expanduser()
        suffix = target.suffix.lower()

        if suffix == ".pdf":
            return self.ocr_pdf(str(target))
        elif suffix in (".png", ".jpg", ".jpeg", ".tiff", ".bmp", ".webp"):
            return self.ocr_image(str(target))
        elif suffix in (".txt", ".md", ".json", ".csv", ".tsv", ".yaml", ".yml"):
            try:
                text = target.read_text(encoding="utf-8", errors="replace")
                return {"status": "ok", "path": str(target), "text": text}
            except Exception as exc:
                return {"status": "error", "error": str(exc)}
        else:
            return {"status": "error", "error": f"Unsupported file type: {suffix}"}


_DEFAULT_OCR_ADAPTER: Optional[OCRAdapter] = None


def get_default_ocr_adapter() -> OCRAdapter:
    global _DEFAULT_OCR_ADAPTER
    if _DEFAULT_OCR_ADAPTER is None:
        _DEFAULT_OCR_ADAPTER = OCRAdapter()
    return _DEFAULT_OCR_ADAPTER
