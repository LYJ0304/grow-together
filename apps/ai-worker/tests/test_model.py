import asyncio
import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest

from app.core.config import settings
from app.model import stream_text


def test_compatible_provider_stream_and_auth(monkeypatch):
    captured = []

    class Provider(BaseHTTPRequestHandler):
        def do_POST(self):
            captured.append(
                (
                    self.path,
                    self.headers.get("Authorization"),
                    json.loads(self.rfile.read(int(self.headers["Content-Length"]))),
                )
            )
            chunks = [
                {
                    "id": "c1",
                    "object": "chat.completion.chunk",
                    "created": 1,
                    "model": "test",
                    "choices": [{"index": 0, "delta": {"content": "안녕"}, "finish_reason": None}],
                },
                {
                    "id": "c1",
                    "object": "chat.completion.chunk",
                    "created": 1,
                    "model": "test",
                    "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}],
                },
            ]
            data = (
                "".join(f"data: {json.dumps(chunk)}\n\n" for chunk in chunks) + "data: [DONE]\n\n"
            ).encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def log_message(self, *_args):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Provider)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    monkeypatch.setattr(settings, "model_base_url", f"http://127.0.0.1:{server.server_port}/v1")
    monkeypatch.setattr(settings, "model_api_key", "test-provider-key")
    monkeypatch.setattr(settings, "model_name", "test-model")

    async def check():
        return [text async for text in stream_text([{"role": "user", "content": "질문"}])]

    try:
        assert asyncio.run(check()) == ["안녕"]
        path, authorization, body = captured[0]
        assert path == "/v1/chat/completions"
        assert authorization == "Bearer test-provider-key"
        assert body["model"] == "test-model"
        assert body["stream"] is True
        assert body["messages"] == [{"role": "user", "content": "질문"}]
    finally:
        server.shutdown()
        server.server_close()


@pytest.mark.parametrize("text", ["x" * 4001, "🙂" * 2001], ids=["ascii", "emoji"])
def test_oversized_output_is_rejected_before_exposing_it(text):
    from test_agent import run_input

    from app.agent import stream_events

    async def source():
        yield text

    async def check():
        events = [
            json.loads(frame.removeprefix("data: "))
            async for frame in stream_events(run_input(), source())
        ]
        assert events[-1]["type"] == "RUN_ERROR"
        assert not any(event["type"] == "TEXT_MESSAGE_CONTENT" for event in events)

    asyncio.run(check())
