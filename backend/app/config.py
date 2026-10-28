from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore", case_sensitive=False
    )

    app_name: str = "Premium Auto Parts API"
    app_env: Literal["development", "test", "production"] = "development"
    site_url: str = "https://zapchast.king.tj"
    debug: bool = False
    api_v1_prefix: str = "/api/v1"
    database_url: str = "sqlite:///./data/autouniverse.db"
    jwt_secret: SecretStr = Field(min_length=32)
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = Field(default=15, ge=1, le=1440)
    refresh_token_expire_days: int = Field(default=30, ge=1, le=365)
    cors_origins: list[str] = []
    login_rate_limit: int = Field(default=5, ge=1)
    login_rate_window_seconds: int = Field(default=60, ge=1)

    @field_validator("site_url")
    @classmethod
    def validate_site_url(cls, value: str) -> str:
        from urllib.parse import urlsplit

        parts = urlsplit(value)
        if (parts.scheme not in {"http", "https"} or not parts.hostname
                or parts.username or parts.password or parts.query or parts.fragment
                or parts.path not in {"", "/"}):
            raise ValueError("SITE_URL must be an HTTP(S) origin without credentials, path or query")
        return value.rstrip("/")

    @model_validator(mode="after")
    def validate_production(self) -> "Settings":
        if self.app_env == "production":
            if self.debug:
                raise ValueError("DEBUG must be false in production")
            if not self.database_url.startswith("postgresql+psycopg://"):
                raise ValueError("Production requires PostgreSQL with the psycopg driver")
            secret = self.jwt_secret.get_secret_value()
            if "replace-with" in secret.lower() or "test-secret" in secret.lower():
                raise ValueError("Generate a private random JWT_SECRET for production")
            if not self.site_url.startswith("https://"):
                raise ValueError("Production SITE_URL requires HTTPS")
            if "*" in self.cors_origins:
                raise ValueError("Production CORS_ORIGINS must list explicit origins")
        return self

    @field_validator("debug", mode="before")
    @classmethod
    def parse_debug(cls, v: object) -> bool:
        if isinstance(v, bool):
            return v
        if isinstance(v, str):
            return v.strip().lower() in ("true", "1", "yes", "on", "debug")
        return bool(v)


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
