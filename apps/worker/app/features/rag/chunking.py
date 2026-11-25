import unicodedata

MAX_DOCUMENT_CHARS = 100_000
MAX_DOCUMENT_BYTES = 200_000
MAX_CHUNKS = 160


def normalize_text(text: str) -> str:
    text = unicodedata.normalize("NFC", text.replace("\r\n", "\n").replace("\r", "\n")).strip()
    if not text or len(text) > MAX_DOCUMENT_CHARS or len(text.encode("utf-8")) > MAX_DOCUMENT_BYTES:
        raise ValueError("Document must contain bounded UTF-8 text")
    return text


def split_text(text: str, size: int = 800, overlap: int = 120) -> list[str]:
    if not 1 <= size <= 2000 or not 0 <= overlap < size:
        raise ValueError("Invalid chunk configuration")
    text = normalize_text(text)
    chunks = []
    start = 0
    windows = 0
    while start < len(text):
        windows += 1
        if windows > MAX_CHUNKS:
            raise ValueError("Document produces too many chunks")
        end = min(start + size, len(text))
        if chunk := text[start:end].strip():
            chunks.append(chunk)
        if end == len(text):
            break
        start = end - overlap
    if len(chunks) > MAX_CHUNKS:
        raise ValueError("Document produces too many chunks")
    return chunks
