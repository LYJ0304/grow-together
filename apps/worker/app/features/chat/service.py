from .generator import ChatGenerator
from .prompts import SYSTEM_PROMPT
from .schemas import ChatGenerateRequest, ChatGenerateResponse


class ChatService:
    def __init__(self, generator: ChatGenerator):
        self.generator = generator

    async def generate(
        self,
        request: ChatGenerateRequest,
    ) -> ChatGenerateResponse:

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            *[message.model_dump() for message in request.history],
            {"role": "user", "content": request.message},
        ]

        result = await self.generator.generate(messages)

        return ChatGenerateResponse(
            content=result.content,
            model=result.model,
        )
