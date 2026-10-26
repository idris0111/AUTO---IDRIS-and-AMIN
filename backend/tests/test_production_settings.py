import pytest
from pydantic import ValidationError

from app.config import Settings


def production_settings(**overrides):
    values = {
        "_env_file": None,
        "app_env": "production",
        "debug": False,
        "database_url": "postgresql+psycopg://zapchast@/zapchast?host=/var/run/postgresql",
        "jwt_secret": "production-unit-fixture-value-with-sufficient-length",
        "site_url": "https://zapchast.king.tj",
        "cors_origins": ["https://zapchast.king.tj"],
    }
    return Settings(**(values | overrides))


def test_native_postgresql_production_settings():
    settings = production_settings(site_url="https://zapchast.king.tj/")
    assert settings.site_url == "https://zapchast.king.tj"


@pytest.mark.parametrize("overrides", [
    {"debug": True},
    {"database_url": "sqlite:///production.db"},
    {"jwt_secret": "replace-with-at-least-32-random-characters"},
    {"site_url": "http://zapchast.king.tj"},
    {"cors_origins": ["*"]},
])
def test_unsafe_production_settings_are_rejected(overrides):
    with pytest.raises(ValidationError):
        production_settings(**overrides)


@pytest.mark.parametrize("origin", [
    "https://user:password@zapchast.king.tj",
    "https://zapchast.king.tj/path",
    "https://zapchast.king.tj?query=1",
    "https://zapchast.king.tj/#fragment",
    "javascript:alert(1)",
])
def test_site_origin_rejects_credentials_and_paths(origin):
    with pytest.raises(ValidationError):
        production_settings(site_url=origin)
