# GrowTogether AI Worker

Runs internal AI jobs independently from the API. It currently executes only an example job.

From this directory, copy `.env.example` to `.env` and run `uv run python -m app.main`.
The worker reads `SERVICE_NAME` and `LOG_LEVEL` from its local `.env`.
