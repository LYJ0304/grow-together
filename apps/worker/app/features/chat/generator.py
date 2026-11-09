from app.llm.client import OpenRouterClient

from .schemas import ChatGenerateResponse


class ChatGenerator:
    def __init__(self, llm_client: OpenRouterClient):
        self.llm_client = llm_client

    async def generate(self, messages: list[dict[str, str]]) -> ChatGenerateResponse:
        content = await self.llm_client.complete_chat(messages=messages)
        return ChatGenerateResponse(content=content, model=self.llm_client.model)
