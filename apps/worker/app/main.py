import asyncio
import logging

from fastapi import FastAPI

from app.api.routers.chat import router as chat_router
from app.api.routers.diary import router as diary_router
from app.api.routers.report import router as report_router
from app.api.routers.schedule import router as schedule_router
from app.core.config import settings
from app.core.logging import configure_logging
from app.features.report.body_limit import ReportBodyLimit
from app.jobs.example import ExampleJob

app = FastAPI()
app.add_middleware(ReportBodyLimit)
app.include_router(report_router)
app.include_router(diary_router)
app.include_router(schedule_router)
app.include_router(chat_router)


async def run() -> str:
    result = await ExampleJob().run()
    logging.getLogger(__name__).info("%s: %s", settings.service_name, result)
    return result


def main() -> None:
    configure_logging(settings.log_level)
    asyncio.run(run())


if __name__ == "__main__":
    main()
