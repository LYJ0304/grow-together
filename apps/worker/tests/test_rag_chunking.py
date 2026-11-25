import pytest

from app.features.rag.chunking import split_text


def test_chunks_keep_overlap_and_do_not_duplicate_the_tail():
    assert split_text("가나다라마바사아자차", size=5, overlap=2) == [
        "가나다라마",
        "라마바사아",
        "사아자차",
    ]
    assert split_text("가나다라마", size=5, overlap=2) == ["가나다라마"]


@pytest.mark.parametrize("text", ["", " \r\n ", "x" * 100001], ids=["empty", "blank", "oversized"])
def test_empty_or_oversized_documents_fail(text):
    with pytest.raises(ValueError):
        split_text(text)


@pytest.mark.parametrize(("size", "overlap"), [(0, 0), (3, 3), (3, -1)])
def test_invalid_chunk_configuration_fails(size, overlap):
    with pytest.raises(ValueError):
        split_text("abcdef", size, overlap)


def test_normalizes_newlines_and_combining_characters():
    assert split_text("  e\u0301\r\n아이  ") == ["é\n아이"]
