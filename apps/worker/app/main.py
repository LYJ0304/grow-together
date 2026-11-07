import asyncio
import logging

from fastapi import FastAPI

from app.api.routes.diary import router as diary_router
from app.core.config import settings
from app.core.logging import configure_logging
from app.jobs.example import ExampleJob

app = FastAPI()
app.include_router(diary_router)


async def run() -> str:
    result = await ExampleJob().run()
    logging.getLogger(__name__).info("%s: %s", settings.service_name, result)
    return result


def main() -> None:
    configure_logging(settings.log_level)
    asyncio.run(run())


if __name__ == "__main__":
    main()
