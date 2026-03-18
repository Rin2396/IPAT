from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    DATABASE_URL: str = "postgresql://ipat:ipat_secret@localhost:5432/ipat"
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "amqp://ipat:ipat_secret@localhost:5672//"

    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET: str = "reports"
    MINIO_SECURE: bool = False

    JWT_SECRET: str = "change_me_in_production"
    JWT_REFRESH_SECRET: str = "change_me_refresh_in_production"
    JWT_ACCESS_EXPIRE_MINUTES: int = 15
    JWT_REFRESH_EXPIRE_DAYS: int = 7

    ADMIN_EMAIL: str = "admin@college.local"
    ADMIN_PASSWORD: str = "admin123"

    CORS_ORIGINS: list[str] = ["*"]


settings = Settings()
