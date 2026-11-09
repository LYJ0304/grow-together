import json

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

        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        if request.child_context is not None:
            context = request.child_context.model_dump(exclude_none=True)
            if request.child_context.age_months is not None or any(context.values()):
                messages.append({
                    "role": "user",
                    "content": json.dumps({"child_context": context}, ensure_ascii=False),
                })
        messages.extend(message.model_dump() for message in request.history)
        messages.append({"role": "user", "content": request.message})

        result = await self.generator.generate(messages)

        return ChatGenerateResponse(
            content=result.content,
            model=result.model,
        )
