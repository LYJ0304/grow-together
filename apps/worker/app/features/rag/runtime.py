from contextlib import asynccontextmanager

from fastapi import HTTPException, Request

from app.core.config import settings
from app.llm.client import OpenRouterClient

from .embeddings import OpenRouterEmbeddings
from .errors import RagConfigurationError
from .models import DEFAULT_EMBEDDING_MODEL, CollectionSpec
from .service import RagService
from .storage import RagRepository, create_pool


@asynccontextmanager
async def lifespan(app):
    pool = None
    app.state.rag_service = None
    try:
        if settings.rag_enabled:
            if settings.rag_database_url is None:
                raise RagConfigurationError("RAG reader URL is required when enabled")
            spec = CollectionSpec(
                embedding_model=settings.rag_embedding_model or DEFAULT_EMBEDDING_MODEL
            )
            pool = create_pool(settings.rag_database_url.get_secret_value(), "rag_reader")
            await pool.open()
            app.state.rag_service = RagService(
                RagRepository(pool),
                OpenRouterEmbeddings(
                    settings.openrouter_api_key.get_secret_value(), spec.embedding_model
                ),
                OpenRouterClient(
                    api_key=settings.openrouter_api_key.get_secret_value(),
                    model=settings.llm_chat_model,
                ),
                spec,
                settings.rag_min_similarity,
            )
        yield
    finally:
        app.state.rag_service = None
        if pool is not None:
            await pool.close(timeout=5)


def get_rag_service(request: Request) -> RagService:
    service = getattr(request.app.state, "rag_service", None)
    if service is None:
        raise HTTPException(
            status_code=503,
            detail={"code": "RAG_UNAVAILABLE", "message": "RAG is disabled or unavailable"},
        )
    return service
