import json

from app.features.child_context import child_context_data

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
        context = child_context_data(request.child_context)
        if context is not None:
            messages.append(
                {
                    "role": "user",
                    "content": json.dumps({"child_context": context}, ensure_ascii=False),
                }
            )
        if request.diary_context:
            messages.append(
                {
                    "role": "user",
                    "content": json.dumps(
                        {"diary_context": [entry.model_dump() for entry in request.diary_context]},
                        ensure_ascii=False,
                    ),
                }
            )
        messages.extend(message.model_dump() for message in request.history)
        messages.append({"role": "user", "content": request.message})

        result = await self.generator.generate(messages)

        return ChatGenerateResponse(
            content=result.content,
            model=result.model,
        )
