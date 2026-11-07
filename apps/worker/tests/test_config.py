import pytest
from pydantic import ValidationError


def test_settings_read_environment_and_hide_secrets(worker_environment) -> None:
    from app.core.config import Settings

    settings = Settings(_env_file=None)
    assert settings.ai_worker_api_key.get_secret_value() == "test-worker-key"
    assert settings.openrouter_api_key.get_secret_value() == "test-router-key"
    assert settings.llm_diary_model == "test/model"
    assert "test-worker-key" not in repr(settings)
    assert "test-router-key" not in repr(settings)


@pytest.mark.parametrize(
    ("environment_key", "field"),
    [
        ("AI_WORKER_API_KEY", "ai_worker_api_key"),
        ("OPENROUTER_API_KEY", "openrouter_api_key"),
        ("LLM_DIARY_MODEL", "llm_diary_model"),
    ],
)
def test_settings_require_credentials_and_model(
    worker_environment, monkeypatch, environment_key, field
):
    from app.core.config import Settings

    monkeypatch.delenv(environment_key)
    with pytest.raises(ValidationError) as raised:
        Settings(_env_file=None)
    assert any(
        error["loc"] == (field,) and error["type"] == "missing" for error in raised.value.errors()
    )
