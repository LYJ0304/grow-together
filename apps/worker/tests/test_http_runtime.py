"""Exercise the production HTTP entry point without calling an external model."""

import socket
import subprocess
import sys
import time

import httpx


def test_uvicorn_serves_internal_contract_and_requires_service_key(worker_environment):
    with socket.socket() as socket_:
        socket_.bind(("127.0.0.1", 0))
        port = socket_.getsockname()[1]
    process = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "app.main:app",
            "--host",
            "127.0.0.1",
            "--port",
            str(port),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    base = f"http://127.0.0.1:{port}"
    try:
        with httpx.Client(timeout=2, trust_env=False) as client:
            for _ in range(100):
                assert process.poll() is None, "HTTP worker exited during startup"
                try:
                    response = client.get(base + "/openapi.json")
                    if response.status_code == 200:
                        break
                except httpx.ConnectError:
                    pass
                time.sleep(0.05)
            else:
                raise AssertionError("HTTP worker did not become ready")
            assert "/internal/v1/schedule/generate" in response.json()["paths"]
            report_path = "/internal/v1/reports/weekly/generate"
            assert report_path in response.json()["paths"]
            assert client.post(base + report_path, json={}).status_code == 401
            assert (
                client.post(
                    base + report_path,
                    json={},
                    headers={
                        "X-API-Key": "test-worker-key",
                    },
                ).status_code
                == 422
            )
            assert client.post(base + "/internal/v1/schedule/generate", json={}).status_code == 401
            assert (
                client.post(
                    base + "/internal/v1/schedule/generate",
                    json={},
                    headers={"X-API-Key": "test-worker-key"},
                ).status_code
                == 422
            )
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)
