"""Local-only OpenAI-compatible fixture. Never enable this as a production provider."""

import asyncio
import json

from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse

app = FastAPI()
app.state.active = 0


@app.get("/stats")
async def stats():
    return {"active": app.state.active}


@app.post("/v1/chat/completions")
async def completion(request: Request):
    body = await request.json()
    mode = body["messages"][-1]["content"]

    async def frames():
        app.state.active += 1
        try:
            if mode == "느린 응답":
                await asyncio.sleep(2)
            for text in ["안녕", "하세요. 테스트 상담 응답이에요."]:
                yield (
                    "data: "
                    + json.dumps(
                        {
                            "id": "fixture",
                            "object": "chat.completion.chunk",
                            "created": 1,
                            "model": "test-model",
                            "choices": [
                                {"index": 0, "delta": {"content": text}, "finish_reason": None},
                            ],
                        }
                    )
                    + "\n\n"
                )
                await asyncio.sleep(0.5)
                if mode == "오류 응답":
                    yield 'data: {"error":{"message":"fixture failure","type":"test"}}\n\n'
                    return
                if mode == "연결 끊김":
                    return
                if mode == "중단 테스트":
                    await asyncio.sleep(10)
            yield (
                "data: "
                + json.dumps(
                    {
                        "id": "fixture",
                        "object": "chat.completion.chunk",
                        "created": 1,
                        "model": "test-model",
                        "choices": [
                            {"index": 0, "delta": {}, "finish_reason": "stop"},
                        ],
                    }
                )
                + "\n\ndata: [DONE]\n\n"
            )
        finally:
            app.state.active -= 1

    return StreamingResponse(frames(), media_type="text/event-stream")
