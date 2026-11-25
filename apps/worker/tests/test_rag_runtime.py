import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest
from pydantic import SecretStr

from app.features.rag.errors import RagConfigurationError
from app.features.rag.storage import validate_database_url


@pytest.mark.parametrize(
    "url",
    [
        "postgresql://rag_admin:secret@host/growtogether_rag",
        "postgresql://rag_reader:secret@host/service",
        "postgresql://rag_reader:secret@host/growtogether_rag?options=unsafe",
        "https://rag_reader:secret@host/growtogether_rag",
        "postgresql://rag_reader:secret@[broken",
        "postgresql://rag_reader:secret%xx@host/growtogether_rag",
    ],
)
def test_wrong_role_or_database_configuration_is_rejected_without_secret(url):
    with pytest.raises(RagConfigurationError) as caught:
        validate_database_url(url, "rag_reader")
    assert "secret" not in str(caught.value)


def test_disabled_lifespan_never_creates_pool(worker_environment, monkeypatch):
    from app.features.rag import runtime

    monkeypatch.setattr(runtime.settings, "rag_enabled", False)
    factory = Mock(side_effect=AssertionError("Must not create a pool"))
    monkeypatch.setattr(runtime, "create_pool", factory)
    app = SimpleNamespace(state=SimpleNamespace())

    async def run():
        async with runtime.lifespan(app):
            assert app.state.rag_service is None

    asyncio.run(run())
    factory.assert_not_called()


@pytest.mark.parametrize("open_fails", [False, True])
def test_enabled_lifespan_closes_pool_even_on_failure(worker_environment, monkeypatch, open_fails):
    from app.features.rag import runtime

    monkeypatch.setattr(runtime.settings, "rag_enabled", True)
    monkeypatch.setattr(
        runtime.settings,
        "rag_database_url",
        SecretStr("postgresql://rag_reader:secret@host/growtogether_rag"),
    )
    pool = SimpleNamespace(
        open=AsyncMock(side_effect=RuntimeError("fixture") if open_fails else None),
        close=AsyncMock(),
    )
    monkeypatch.setattr(runtime, "create_pool", Mock(return_value=pool))
    app = SimpleNamespace(state=SimpleNamespace())

    async def run():
        async with runtime.lifespan(app):
            assert app.state.rag_service is not None

    if open_fails:
        with pytest.raises(RuntimeError):
            asyncio.run(run())
    else:
        asyncio.run(run())
    pool.close.assert_awaited_once_with(timeout=5)
    assert app.state.rag_service is None


def test_enabled_without_reader_url_fails_configuration(worker_environment, monkeypatch):
    from app.features.rag import runtime

    monkeypatch.setattr(runtime.settings, "rag_enabled", True)
    monkeypatch.setattr(runtime.settings, "rag_database_url", None)

    async def run():
        async with runtime.lifespan(SimpleNamespace(state=SimpleNamespace())):
            raise AssertionError("Must not start")

    with pytest.raises(RagConfigurationError):
        asyncio.run(run())
