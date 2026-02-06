from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    gemini_api_key: str = ""
    # Vertex AI settings (use these instead of gemini_api_key for GCP)
    gcp_project_id: str = ""
    gcp_location: str = "us-central1"
    use_vertex_ai: bool = False

    composio_api_key: str = ""
    composio_auth_config_id: str = ""
    composio_auth_config_id_google_drive: str = ""
    render_db_url: str = ""
    frontend_url: str = "http://localhost:3000"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()
