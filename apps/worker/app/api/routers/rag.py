from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.dependencies import verify_service_key
from app.features.rag.errors import (
    RagCollectionError,
    RagConfigurationError,
    RagEmbeddingError,
    RagGenerationError,
    RagStorageError,
    RagTimeoutError,
)
from app.features.rag.models import QueryRequest, QueryResponse
from app.features.rag.runtime import get_rag_service
from app.features.rag.service import RagService
from app.llm.errors import LLMError, LLMTimeoutError


class RagErrorDetail(BaseModel):
    code: str
    message: str


class RagErrorResponse(BaseModel):
    detail: RagErrorDetail


router = APIRouter(
    prefix="/internal/v1/rag", tags=["rag"], dependencies=[Depends(verify_service_key)]
)


@router.post(
    "/query",
    response_model=QueryResponse,
    responses={code: {"model": RagErrorResponse} for code in [408, 409, 413, 502, 503, 504]},
)
async def query(
    request: QueryRequest, service: Annotated[RagService, Depends(get_rag_service)]
) -> QueryResponse:
    try:
        return await service.query(request)
    except (RagTimeoutError, LLMTimeoutError):
        raise HTTPException(
            504, detail={"code": "RAG_TIMEOUT", "message": "RAG request timed out"}
        ) from None
    except RagCollectionError:
        raise HTTPException(
            409,
            detail={
                "code": "RAG_COLLECTION_MISMATCH",
                "message": "RAG collection configuration mismatch",
            },
        ) from None
    except (RagStorageError, RagConfigurationError):
        raise HTTPException(
            503, detail={"code": "RAG_STORAGE_UNAVAILABLE", "message": "RAG storage unavailable"}
        ) from None
    except RagEmbeddingError:
        raise HTTPException(
            502, detail={"code": "RAG_EMBEDDING_FAILED", "message": "RAG embedding failed"}
        ) from None
    except (RagGenerationError, LLMError):
        raise HTTPException(
            502, detail={"code": "RAG_GENERATION_FAILED", "message": "RAG generation failed"}
        ) from None
