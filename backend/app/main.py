from fastapi import FastAPI, HTTPException, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

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


# =============================================================================
# Composio OAuth Endpoints (matches frontend expectations)
# =============================================================================

class ConnectRequest(BaseModel):
    projectId: str
    redirectUrl: str


class ConnectResponse(BaseModel):
    redirectUrl: str
    connectionId: str


@app.post("/api/composio/connect/google", response_model=ConnectResponse)
async def connect_google(request: ConnectRequest, x_user_id: str = Header(default="default")):
    """Initiate Google Drive OAuth connection."""
    service = get_composio_service()
    settings = get_settings()
    redirect_url = service.get_auth_url(x_user_id, request.redirectUrl or settings.frontend_url, use_drive=True)
    return ConnectResponse(
        redirectUrl=redirect_url,
        connectionId=f"conn_{x_user_id}",
    )


@app.post("/api/composio/connect/onedrive", response_model=ConnectResponse)
async def connect_onedrive(request: ConnectRequest, x_user_id: str = Header(default="default")):
    """Initiate OneDrive OAuth connection (placeholder)."""
    # OneDrive not implemented yet
    raise HTTPException(status_code=501, detail="OneDrive integration not implemented yet")


class ConnectionStatusResponse(BaseModel):
    status: str  # ACTIVE, PENDING, FAILED
    email: Optional[str] = None
    error: Optional[str] = None


@app.get("/api/composio/status", response_model=ConnectionStatusResponse)
async def composio_status(
    provider: str = Query(default="google-drive"),
    x_user_id: str = Header(default="default")
):
    """Check connection status for a provider."""
    service = get_composio_service()
    connected = service.is_connected(x_user_id)

    if connected:
        return ConnectionStatusResponse(status="ACTIVE", email=f"{x_user_id}@connected")
    else:
        return ConnectionStatusResponse(status="PENDING")


class ConnectedAccount(BaseModel):
    provider: str
    email: str
    connectedAt: str


@app.get("/api/composio/connections")
async def get_connections(x_user_id: str = Header(default="default")):
    """Get all connected accounts for user."""
    from datetime import datetime

    service = get_composio_service()
    accounts = []

    if service.is_connected(x_user_id):
        accounts.append(ConnectedAccount(
            provider="google-drive",
            email=f"{x_user_id}@connected",
            connectedAt=datetime.now().isoformat(),
        ))

    return accounts


# =============================================================================
# Spreadsheet/Files Endpoints
# =============================================================================

class SpreadsheetFile(BaseModel):
    id: str
    name: str
    mimeType: str
    modifiedTime: Optional[str] = None
    size: Optional[int] = None
    source: str = "google-drive"
    path: Optional[str] = None


@app.get("/api/spreadsheets")
async def get_spreadsheets(
    provider: str = Query(default="google-drive"),
    x_user_id: str = Header(default="default")
):
    """List user's spreadsheet files from cloud provider."""
    service = get_composio_service()

    if not service.is_connected(x_user_id):
        raise HTTPException(status_code=401, detail="Not connected to cloud provider")

    files = service.list_spreadsheet_files(x_user_id)

    # Transform to match frontend expectations
    return [
        SpreadsheetFile(
            id=f["id"],
            name=f["name"],
            mimeType=f["mimeType"],
            modifiedTime=f.get("modifiedTime"),
            source=provider,
        )
        for f in files
    ]


# Keep old endpoint for backwards compatibility
@app.get("/api/files")
async def list_files(x_user_id: str = Header(default="default")):
    """List user's CSV and spreadsheet files from Google Drive."""
    return await get_spreadsheets(provider="google-drive", x_user_id=x_user_id)


# =============================================================================
# Chat Endpoint (Gemini-powered)
# =============================================================================

class SchemaColumn(BaseModel):
    name: str
    type: str
    isPrimaryKey: Optional[bool] = None
    isForeignKey: Optional[bool] = None


class SchemaNode(BaseModel):
    id: str
    tableName: str
    source: str
    columns: list[SchemaColumn]


class SchemaEdge(BaseModel):
    id: str
    source: dict
    target: dict
    confidence: float
    joinType: str


class SchemaData(BaseModel):
    nodes: list[SchemaNode]
    edges: list[SchemaEdge]


class DataMetrics(BaseModel):
    totalRecords: int
    tableCount: int
    completenessScore: float
    confirmedJoins: int
    suggestedJoins: int
    uniqueEntities: list[dict]
    dateRange: Optional[dict] = None


class ChatMessage(BaseModel):
    id: str
    role: str
    content: str
    timestamp: str


class ChatContext(BaseModel):
    schema: Optional[SchemaData] = None
    metrics: Optional[DataMetrics] = None
    conversationHistory: list[ChatMessage] = []


class ChatRequest(BaseModel):
    projectId: str
    message: str
    context: ChatContext


class ChatResponse(BaseModel):
    message: str
    sources: Optional[list[str]] = None


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, x_user_id: str = Header(default="default")):
    """Chat with Gemini about the data."""
    from app.services.gemini import GeminiService

    settings = get_settings()
    gemini = GeminiService(
        api_key=settings.gemini_api_key,
        project_id=settings.gcp_project_id,
        location=settings.gcp_location,
        use_vertex_ai=settings.use_vertex_ai
    )

    # Build context from schema and metrics
    context_parts = []

    if request.context.schema:
        tables = [f"- {node.tableName}: {', '.join(c.name for c in node.columns)}"
                  for node in request.context.schema.nodes]
        context_parts.append(f"Available tables:\n" + "\n".join(tables))

    if request.context.metrics:
        m = request.context.metrics
        context_parts.append(f"Data metrics: {m.totalRecords} records, {m.tableCount} tables, {m.completenessScore}% complete")

    # Build conversation history
    history = "\n".join([
        f"{msg.role}: {msg.content}"
        for msg in request.context.conversationHistory[-5:]  # Last 5 messages
    ])

    # Create prompt for Gemini
    prompt = f"""You are a helpful data analyst assistant. You help users understand their data.

Context about the user's data:
{chr(10).join(context_parts) if context_parts else "No data loaded yet."}

Recent conversation:
{history if history else "This is the start of the conversation."}

User's question: {request.message}

Provide a helpful, concise response about their data. Use markdown formatting for clarity."""

    try:
        response = gemini.client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt
        )
        return ChatResponse(message=response.text)
    except Exception as e:
        return ChatResponse(message=f"I encountered an error: {str(e)}. Please try again.")


# =============================================================================
# Migration Endpoint
# =============================================================================

class MigrateRequest(BaseModel):
    file_ids: list[str]
    database_name: str = "migrated_data"


class MigrateResponse(BaseModel):
    success: bool
    tables_created: list[str]
    rows_inserted: dict[str, int]
    ddl: str
    errors: list[str] = []
    logs: list[str] = []


@app.post("/api/migrate", response_model=MigrateResponse)
async def migrate_files(request: MigrateRequest, x_user_id: str = Header(default="default")):
    """
    Download selected files from Drive, infer schema with Gemini,
    create tables in Postgres, and insert data.
    """
    from app.services.gemini import GeminiService
    from app.services.postgres import PostgresService

    # Collect logs to return to frontend
    logs = []
    def log(msg: str):
        print(msg)  # Also print to console
        logs.append(msg)

    log("🚀 Migration started")
    log(f"📁 Processing {len(request.file_ids)} file(s)")

    settings = get_settings()
    errors = []

    # Initialize services
    log("⚙️ Initializing services...")
    if settings.use_vertex_ai:
        log(f"   Using Vertex AI (project: {settings.gcp_project_id}, location: {settings.gcp_location})")
    else:
        log("   Using Google AI Studio")

    composio = get_composio_service()
    gemini = GeminiService(
        api_key=settings.gemini_api_key,
        project_id=settings.gcp_project_id,
        location=settings.gcp_location,
        use_vertex_ai=settings.use_vertex_ai
    )
    postgres = PostgresService(db_url=settings.render_db_url)
    log("✅ Services initialized")

    if not composio.is_connected(x_user_id):
        log("❌ Google Drive not connected!")
        raise HTTPException(status_code=401, detail="Google Drive not connected")

    # Step 1: Download files from Drive
    log("📥 Step 1: Downloading files from Google Drive...")
    csv_data = {}
    for file_id in request.file_ids:
        try:
            name, content = composio.download_file(x_user_id, file_id)
            log(f"   ✅ Downloaded '{name}' ({len(content):,} bytes)")
            csv_data[name] = content
        except Exception as e:
            log(f"   ❌ Failed to download {file_id}: {str(e)}")
            errors.append(f"Failed to download file {file_id}: {str(e)}")

    if not csv_data:
        log("❌ No files could be downloaded!")
        raise HTTPException(status_code=400, detail="No files could be downloaded")

    log(f"📊 Downloaded {len(csv_data)} file(s): {', '.join(csv_data.keys())}")

    # Step 2: Infer schema with Gemini
    log("🤖 Step 2: Analyzing data with Gemini AI...")
    try:
        ddl = gemini.infer_schema(csv_data)
        log("✅ Schema inference complete!")
    except Exception as e:
        log(f"❌ Schema inference failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Schema inference failed: {str(e)}")

    # Step 3: Create tables in Postgres
    log("🗄️ Step 3: Creating tables in PostgreSQL...")
    try:
        tables = postgres.create_tables(ddl)
        log(f"✅ Created {len(tables)} table(s): {', '.join(tables)}")
    except Exception as e:
        log(f"❌ Table creation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Table creation failed: {str(e)}")

    # Step 4: Insert data
    log("📝 Step 4: Inserting data...")
    rows_inserted = {}
    for name, content in csv_data.items():
        try:
            count = postgres.insert_csv_data(name, content)
            rows_inserted[name] = count
            log(f"   ✅ Inserted {count:,} rows into '{name}'")
        except Exception as e:
            log(f"   ❌ Failed to insert data for {name}: {str(e)}")
            errors.append(f"Failed to insert data for {name}: {str(e)}")

    total_rows = sum(rows_inserted.values())
    if len(errors) == 0:
        log(f"🎉 Migration complete! {len(tables)} tables, {total_rows:,} total rows")
    else:
        log(f"⚠️ Migration completed with {len(errors)} error(s)")

    return MigrateResponse(
        success=len(errors) == 0,
        tables_created=tables,
        rows_inserted=rows_inserted,
        ddl=ddl,
        errors=errors,
        logs=logs,
    )


# =============================================================================
# Legacy endpoints (backwards compatibility)
# =============================================================================

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
async def auth_callback(code: str = Query(default=""), state: str = Query(default="")):
    """OAuth callback from Google - Composio handles this automatically."""
    return {"status": "connected", "message": "Google Drive connected successfully"}
