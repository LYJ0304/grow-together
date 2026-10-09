import asyncio

from app.jobs.example import ExampleJob


def test_example_job_completes() -> None:
    assert asyncio.run(ExampleJob().run()) == "example job completed"
