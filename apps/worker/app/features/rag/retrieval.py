"""Generation-free retrieval shared by RAG consumers and offline evaluation."""

from dataclasses import dataclass

from .errors import RagCollectionError
from .models import RetrievedChunk


@dataclass(frozen=True)
class RetrievalResult:
    hits: list[RetrievedChunk]
    reason: str | None = None


class RagRetriever:
    def __init__(self, repository, embeddings, spec, min_similarity=0.35):
        self.repository = repository
        self.embeddings = embeddings
        self.spec = spec
        self.min_similarity = min_similarity

    async def retrieve(self, request):
        state = await self.repository.collection(request.collection)
        if state is None:
            return RetrievalResult([], "collection_not_found")
        # Query compatibility concerns the embedding space, not how text was chunked.
        for key in ("embedding_model", "dimensions", "distance_metric"):
            if getattr(state.spec, key) != getattr(self.spec, key):
                raise RagCollectionError("Collection embedding configuration mismatch")
        if not state.has_chunks:
            return RetrievalResult([], "no_documents")
        vector = (await self.embeddings.embed([request.question]))[0]
        kwargs = {"filters": request.filters} if request.filters is not None else {}
        hits = await self.repository.search(request.collection, vector, request.top_k, **kwargs)
        relevant = [hit for hit in hits if hit.similarity >= self.min_similarity]
        return RetrievalResult(relevant, None if relevant else "no_relevant_chunks")
