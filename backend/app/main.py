from fastapi import FastAPI, HTTPException, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.config import get_settings

app = FastAPI(
    title="Spreadsheet Migration API",
    description="Migrate spreadsheets from Google Drive to Postgres databases",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


def get_composio_service():
    """Helper to create ComposioService with settings."""
    from app.services.composio import ComposioService
    settings = get_settings()
    return ComposioService(
        api_key=settings.composio_api_key,
        auth_config_id=settings.composio_auth_config_id,
        drive_auth_config_id=settings.composio_auth_config_id_google_drive,
    )


@app.get("/api/auth/status")
async def auth_status(x_user_id: str = Header(default="default")):
    """Check if Google Drive is connected for this user."""
    service = get_composio_service()
    connected = service.is_connected(x_user_id)
    return {"connected": connected, "user_id": x_user_id}


@app.post("/api/auth/connect-drive")
async def connect_drive(x_user_id: str = Header(default="default")):
    """Get OAuth redirect URL for Google Drive connection."""
    service = get_composio_service()
    settings = get_settings()
    redirect_url = service.get_auth_url(x_user_id, settings.frontend_url, use_drive=True)
    return {"redirect_url": redirect_url}


@app.get("/api/auth/callback")
async def auth_callback(code: str = Query(...), state: str = Query(default="")):
    """OAuth callback from Google - Composio handles this automatically."""
    return {"status": "connected", "message": "Google Drive connected successfully"}


@app.get("/api/files")
async def list_files(x_user_id: str = Header(default="default")):
    """List user's CSV and spreadsheet files from Google Drive."""
    service = get_composio_service()

    if not service.is_connected(x_user_id):
        raise HTTPException(status_code=401, detail="Google Drive not connected")

    files = service.list_spreadsheet_files(x_user_id)
    return {"files": files}


class MigrateRequest(BaseModel):
    file_ids: list[str]
    database_name: str = "migrated_data"


class MigrateResponse(BaseModel):
    success: bool
    tables_created: list[str]
    rows_inserted: dict[str, int]
    ddl: str
    errors: list[str] = []


@app.post("/api/migrate", response_model=MigrateResponse)
async def migrate_files(request: MigrateRequest, x_user_id: str = Header(default="default")):
    """
    Download selected files from Drive, infer schema with Gemini,
    create tables in Postgres, and insert data.
    """
    from app.services.gemini import GeminiService
    from app.services.postgres import PostgresService

    settings = get_settings()
    errors = []

    # Initialize services
    composio = get_composio_service()
    gemini = GeminiService(api_key=settings.gemini_api_key)
    postgres = PostgresService(db_url=settings.render_db_url)

    if not composio.is_connected(x_user_id):
        raise HTTPException(status_code=401, detail="Google Drive not connected")

    # Step 1: Download files from Drive
    csv_data = {}
    for file_id in request.file_ids:
        try:
            name, content = composio.download_file(x_user_id, file_id)
            csv_data[name] = content
        except Exception as e:
            errors.append(f"Failed to download file {file_id}: {str(e)}")

    if not csv_data:
        raise HTTPException(status_code=400, detail="No files could be downloaded")

    # Step 2: Infer schema with Gemini
    try:
        ddl = gemini.infer_schema(csv_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Schema inference failed: {str(e)}")

    # Step 3: Create tables in Postgres
    try:
        tables = postgres.create_tables(ddl)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Table creation failed: {str(e)}")

    # Step 4: Insert data
    rows_inserted = {}
    for name, content in csv_data.items():
        try:
            count = postgres.insert_csv_data(name, content)
            rows_inserted[name] = count
        except Exception as e:
            errors.append(f"Failed to insert data for {name}: {str(e)}")

    return MigrateResponse(
        success=len(errors) == 0,
        tables_created=tables,
        rows_inserted=rows_inserted,
        ddl=ddl,
        errors=errors,
    )
