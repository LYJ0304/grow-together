from typing import Protocol


class Job(Protocol):
    async def run(self) -> str: ...
