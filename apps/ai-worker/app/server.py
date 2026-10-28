"""Internal AG-UI HTTP transport. Public authentication belongs to the API."""

import secrets
from typing import Annotated

from ag_ui.core import RunAgentInput
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import StreamingResponse

from app.agent import stream_events
from app.core.config import settings
from app.model import stream_text

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)


def require_worker_token(x_worker_token: Annotated[str, Header()] = "") -> None:
    if not settings.worker_token:
        raise HTTPException(503, "Worker authentication is not configured")
    if not secrets.compare_digest(x_worker_token, settings.worker_token):
        raise HTTPException(401, "Worker authentication required")


@app.post("/agent/run", dependencies=[Depends(require_worker_token)])
async def run_agent(input: RunAgentInput):
    if (
        not input.thread_id
        or len(input.thread_id) > 64
        or not input.run_id
        or len(input.run_id) > 64
        or not 1 <= len(input.messages) <= 40
        or input.messages[-1].role != "user"
        or input.tools
        or input.context
        or input.state
        or input.forwarded_props
        or input.resume
        or any(
            message.role not in {"user", "assistant"}
            or not isinstance(message.content, str)
            or not message.content.strip()
            or len(message.content) > 4000
            for message in input.messages
        )
    ):
        raise HTTPException(422, "Only bounded user/assistant text conversations are supported")
    if not settings.model_api_key or not settings.model_name:
        raise HTTPException(503, "Model is not configured")
    messages = [{"role": message.role, "content": message.content} for message in input.messages]
    return StreamingResponse(
        stream_events(input, stream_text(messages)),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
    )
