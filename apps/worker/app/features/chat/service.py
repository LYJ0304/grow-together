from app.chat.schemas import ChatRequest, ChatResponse
from app.chat.generator import ChatGenerator
from app.chat.prompts import SYSTEM_PROMPT

class ChatService:
    def __init__(self, generator: ChatGenerator):
        self.generator = generator

    async def generate(
        self,
        request: ChatRequest,
    ) -> ChatResponse:

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            *[
                message.model_dump()
                for message in request.history
            ],
            {"role": "user", "content": request.message},
        ]

        result = await self.generator.generate(messages)

        return ChatResponse(
            content=result.content,
            model=result.model,
        )