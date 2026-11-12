"""Bound only this internal endpoint before FastAPI buffers/parses its JSON."""

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

MAX_REQUEST_BYTES = 64 * 1024
REPORT_PATH = "/internal/v1/reports/weekly/generate"


class ReportBodyLimit:
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope["path"].rstrip("/") != REPORT_PATH:
            await self.app(scope, receive, send)
            return
        body = bytearray()
        size = 0
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            size += len(message.get("body", b""))
            if size > MAX_REQUEST_BYTES:
                await JSONResponse({"detail": "Weekly report request too large"}, 413)(
                    scope, receive, send
                )
                return
            body.extend(message.get("body", b""))
            if not message.get("more_body", False):
                break
        # Replay one bounded body instead of retaining an unbounded list of empty chunks.
        body = bytes(body)

        async def replay():
            nonlocal body
            if body is not None:
                message = {"type": "http.request", "body": body, "more_body": False}
                body = None
                return message
            return await receive()

        await self.app(scope, replay, send)
