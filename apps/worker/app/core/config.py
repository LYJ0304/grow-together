from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    service_name: str = "growtogether-worker"
    log_level: str = "INFO"

    ai_worker_api_key: SecretStr
    openrouter_api_key: SecretStr

    llm_diary_model: str

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )


settings = Settings()
