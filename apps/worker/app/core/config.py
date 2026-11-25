from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    service_name: str = "growtogether-worker"
    log_level: str = "INFO"

    ai_worker_api_key: SecretStr
    openrouter_api_key: SecretStr

    # Optional infrastructure setting; never use the service database credentials.
    rag_enabled: bool = False
    rag_embedding_model: str | None = Field(default=None, min_length=1, max_length=200)
    rag_min_similarity: float = Field(default=0.35, ge=0, le=1, allow_inf_nan=False)
    rag_database_url: SecretStr | None = None

    @field_validator("rag_database_url", mode="before")
    @classmethod
    def empty_rag_url(cls, value):
        return None if value == "" else value

    llm_report_model: str | None = None
    llm_chat_model: str
    llm_schedule_model: str | None = None
    llm_diary_model: str

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )


settings = Settings()
