from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    service_name: str = "growtogether-ai-worker"
    log_level: str = "INFO"
    worker_token: str = ""
    model_base_url: str = "https://api.openai.com/v1"
    model_api_key: str = ""
    model_name: str = ""
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
