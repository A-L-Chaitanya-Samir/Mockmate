from io import BytesIO
import re
from pypdf import PdfReader, overwrite_configuration
from app.core.errors import AppError
from app.core.config import settings

def extract_pdf(data: bytes, filename: str, content_type: str) -> str:
    # Context-local configuration must be applied inside each API/worker thread.
    overwrite_configuration(zlib_maximum_output_length=2_000_000,
        maximum_declared_stream_length=2_000_000, stream_decoding_work_maximum_length=10_000_000)
    if not filename.lower().endswith('.pdf') or content_type != 'application/pdf' or not data.startswith(b'%PDF-'):
        raise AppError(422, 'invalid_pdf', 'Choose an actual PDF document.')
    if not data or len(data) > settings().max_pdf_bytes:
        raise AppError(413, 'pdf_size', 'PDF must be non-empty and at most 5 MB.')
    try:
        reader = PdfReader(BytesIO(data), strict=True)
        if reader.is_encrypted:
            raise AppError(422, 'encrypted_pdf', 'Encrypted PDFs are unsupported. Export an unlocked copy.')
        if len(reader.pages) > 20:
            raise AppError(422, 'pdf_pages', 'Use a resume of at most 20 pages.')
        # Bound decompression before asking the parser to extract text.
        parts = []
        for page in reader.pages:
            stream = page.get_contents()
            if stream and len(stream.get_data()) > 2_000_000:
                raise AppError(422, 'pdf_complexity', 'PDF is too complex. Export a simpler document.')
            parts.append(page.extract_text(extraction_mode='plain') or '')
        text = '\n'.join(parts).strip()
    except AppError:
        raise
    except Exception:
        raise AppError(422, 'corrupt_pdf', 'This PDF is corrupt or could not be read.') from None
    if len(text) < 50:
        raise AppError(422, 'no_text', 'No usable text found. Scanned/image-only PDFs need OCR, which is not supported yet.')
    return text


def minimize(text: str) -> str:
    text = re.sub(r'[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}', '[email removed]', text)
    text = re.sub(r'https?://\S+', '[link removed]', text)
    text = re.sub(r'(?<!\w)\+?\d[\d ()-]{8,}\d', '[phone removed]', text)
    return text[:settings().ai_input_chars]
