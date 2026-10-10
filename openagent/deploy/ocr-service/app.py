import os
import tempfile
from threading import Lock

import pypdfium2 as pdfium
from fastapi import FastAPI, File, HTTPException, UploadFile
from rapidocr import RapidOCR


app = FastAPI(title="OpenAgent OCR Service")
ocr_engine = RapidOCR()
ocr_lock = Lock()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/ocr/pdf")
async def ocr_pdf(file: UploadFile = File(...)):
    content = await file.read()
    if not content.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="file must be a PDF")

    try:
        text = read_pdf_text(content)
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"failed to OCR PDF: {err}") from err

    return {"text": text}


def read_pdf_text(content: bytes) -> str:
    temp_path = write_temp_pdf(content)
    try:
        pdf = pdfium.PdfDocument(temp_path)
        try:
            page_texts = [read_page_text(pdf[index], index + 1) for index in range(len(pdf))]
        finally:
            pdf.close()
    finally:
        os.remove(temp_path)

    return "\n\n".join(text for text in page_texts if text)


def write_temp_pdf(content: bytes) -> str:
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as temp_file:
        temp_file.write(content)
        return temp_file.name


def read_page_text(page, page_number: int) -> str:
    try:
        bitmap = page.render(scale=2.0)
        try:
            image = bitmap.to_pil().convert("RGB")
        finally:
            bitmap.close()
    finally:
        page.close()

    with ocr_lock:
        result = ocr_engine(image)

    if result is None or result.txts is None:
        return ""

    text = "\n".join(item for item in result.txts if item)
    if text == "":
        return ""
    return f"Page {page_number}\n{text}"
