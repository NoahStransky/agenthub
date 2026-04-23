"""Pydantic Settings — 集中配置管理."""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # App
    APP_NAME: str = "AgentHub"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://agenthub:agenthub@localhost:5432/agenthub"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT
    SECRET_KEY: str = "change-me-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day

    # Docker
    DOCKER_HOST: str = "unix:///var/run/docker.sock"
    HERMES_BASE_IMAGE: str = "agenthub/hermes-base:latest"
    TENANT_NETWORK: str = "agenthub-tenant"

    # Model Proxy / Billing
    MODEL_PROXY_ENABLED: bool = True
    OPENROUTER_API_KEY: str = ""  # 平台统一代理时使用

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    class Config:
        env_file = ".env"


settings = Settings()
