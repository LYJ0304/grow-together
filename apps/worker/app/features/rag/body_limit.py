import asyncio

from starlette.responses import JSONResponse


class RagBodyLimit:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["path"] != "/internal/v1/rag/query":
            return await self.app(scope, receive, send)
        body = bytearray()
        try:
            async with asyncio.timeout(10):
                while True:
                    message = await receive()
                    if message["type"] == "http.disconnect":
                        return
                    chunk = message.get("body", b"")
                    if len(body) + len(chunk) > 16384:
                        response = JSONResponse(
                            {
                                "detail": {
                                    "code": "RAG_BODY_TOO_LARGE",
                                    "message": "RAG request body is too large",
                                }
                            },
                            status_code=413,
                        )
                        return await response(scope, receive, send)
                    body.extend(chunk)
                    if not message.get("more_body", False):
                        break
        except TimeoutError:
            response = JSONResponse(
                {"detail": {"code": "RAG_BODY_TIMEOUT", "message": "RAG request body timed out"}},
                status_code=408,
            )
            return await response(scope, receive, send)
        replayed = False

        async def replay():
            nonlocal replayed
            if not replayed:
                replayed = True
                return {"type": "http.request", "body": bytes(body), "more_body": False}
            return await receive()

        await self.app(scope, replay, send)
