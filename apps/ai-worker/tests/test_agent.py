import asyncio
import json

from ag_ui.core import RunAgentInput
from fastapi.testclient import TestClient

from app.agent import stream_events
from app.core.config import settings
from app.server import app


def run_input():
    return RunAgentInput(
        thread_id="thread-1",
        run_id="run-1",
        state={},
        tools=[],
        context=[],
        messages=[{"id": "user-1", "role": "user", "content": "안녕하세요"}],
    )


def test_streams_text_before_completion_and_closes_source():
    closed = []

    async def source():
        try:
            yield "안녕"
            yield "하세요"
        finally:
            closed.append(True)

    async def check():
        events = stream_events(run_input(), source())
        first = await anext(events)
        assert json.loads(first.removeprefix("data: "))["type"] == "RUN_STARTED"
        assert not closed
        rest = [json.loads(frame.removeprefix("data: ")) async for frame in events]
        assert [event["type"] for event in rest] == [
            "TEXT_MESSAGE_START",
            "TEXT_MESSAGE_CONTENT",
            "TEXT_MESSAGE_CONTENT",
            "TEXT_MESSAGE_END",
            "RUN_FINISHED",
        ]
        assert "".join(event.get("delta", "") for event in rest) == "안녕하세요"
        assert rest[-1]["runId"] == "run-1"
        assert closed == [True]

    asyncio.run(check())


def test_errors_are_sanitized_and_never_finish_successfully():
    async def source():
        yield "일부 응답"
        raise RuntimeError("private-provider-key")

    async def check():
        frames = [frame async for frame in stream_events(run_input(), source())]
        assert "private-provider-key" not in "".join(frames)
        events = [json.loads(frame.removeprefix("data: ")) for frame in frames]
        assert events[-1]["type"] == "RUN_ERROR"
        assert not any(event["type"] == "RUN_FINISHED" for event in events)

    asyncio.run(check())


def test_cancellation_closes_provider():
    closed = []

    async def source():
        try:
            yield "첫 응답"
            await asyncio.sleep(60)
        finally:
            closed.append(True)

    async def check():
        events = stream_events(run_input(), source())
        for _ in range(3):
            await anext(events)
        await events.aclose()
        assert closed == [True]

    asyncio.run(check())


def test_internal_endpoint_requires_token_and_validates_input(monkeypatch):
    monkeypatch.setattr(settings, "worker_token", "test-worker-token")
    with TestClient(app) as client:
        body = run_input().model_dump(by_alias=True)
        assert client.post("/agent/run", json=body).status_code == 401
        headers = {"X-Worker-Token": "test-worker-token"}
        body["messages"][0]["role"] = "system"
        assert client.post("/agent/run", json=body, headers=headers).status_code == 422


def test_missing_model_configuration_fails_before_stream(monkeypatch):
    monkeypatch.setattr(settings, "worker_token", "test-worker-token")
    monkeypatch.setattr(settings, "model_api_key", "")
    with TestClient(app) as client:
        response = client.post(
            "/agent/run",
            json=run_input().model_dump(by_alias=True),
            headers={"X-Worker-Token": "test-worker-token"},
        )
        assert response.status_code == 503
        assert "text/event-stream" not in response.headers["content-type"]
