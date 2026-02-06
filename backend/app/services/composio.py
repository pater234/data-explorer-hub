from composio import Composio, ComposioToolSet
import logging

logger = logging.getLogger(__name__)


class ComposioService:
    # Class-level cache for file lists (simple in-memory cache)
    _file_cache: dict[str, list[dict]] = {}

    def __init__(self, api_key: str, auth_config_id: str, drive_auth_config_id: str = ""):
        self.api_key = api_key
        self.auth_config_id = auth_config_id
        self.drive_auth_config_id = drive_auth_config_id or auth_config_id
        self.sdk = Composio(api_key=api_key) if api_key else None

    def _get_toolset(self, user_id: str) -> ComposioToolSet:
        """Get a ComposioToolSet for executing actions."""
        return ComposioToolSet(api_key=self.api_key, entity_id=user_id)

    def is_connected(self, user_id: str, require_drive: bool = True) -> bool:
        """Check if user has connected their Google Sheets/Drive."""
        if not self.sdk:
            return False

        try:
            entity = self.sdk.get_entity(user_id)
            connections = entity.get_connections()
            has_drive = False
            has_sheets = False
            for conn in connections:
                app_name = getattr(conn, 'appName', '') or getattr(conn, 'app_name', '') or ''
                status = getattr(conn, 'status', 'ACTIVE')
                if status != "ACTIVE":
                    continue
                if app_name.lower() in ['googledrive', 'google_drive']:
                    has_drive = True
                if app_name.lower() in ['googlesheets', 'google_sheets']:
                    has_sheets = True

            if require_drive:
                return has_drive
            return has_drive or has_sheets
        except Exception:
            return False

    def get_auth_url(self, user_id: str, redirect_url: str, use_drive: bool = False) -> str:
        """Get OAuth URL for Google Drive/Sheets connection."""
        if not self.sdk:
            raise ValueError("Composio API key not configured")

        config_id = self.drive_auth_config_id if use_drive else self.auth_config_id
        app_name = "googledrive" if use_drive else "googlesheets"

        entity = self.sdk.get_entity(user_id)
        connection_request = entity.initiate_connection(
            app_name=app_name,
            auth_config={
                "auth_config_id": config_id,
            },
            redirect_url=redirect_url,
        )
        return connection_request.redirectUrl

    def get_file_info(self, user_id: str, file_id: str) -> dict | None:
        """Get file info from cache without re-fetching all files."""
        cache_key = f"{user_id}_files"
        if cache_key in ComposioService._file_cache:
            for f in ComposioService._file_cache[cache_key]:
                if f.get("id") == file_id:
                    return f
        return None

    def list_spreadsheet_files(self, user_id: str, use_cache: bool = True) -> list[dict]:
        """List CSV and spreadsheet files from user's Google Drive."""
        if not self.api_key:
            raise ValueError("Composio API key not configured")

        # Check cache first
        cache_key = f"{user_id}_files"
        if use_cache and cache_key in ComposioService._file_cache:
            logger.info(f"Using cached file list ({len(ComposioService._file_cache[cache_key])} files)")
            return ComposioService._file_cache[cache_key]

        toolset = self._get_toolset(user_id)
        logger.info("Fetching all files from Google Drive (with pagination)...")

        # Composio's GOOGLEDRIVE_FIND_FILE ignores search_query, so we need to
        # list ALL files and filter client-side
        all_files = {}

        # Allowed mime types for spreadsheets/CSVs
        allowed_mimes = {
            'text/csv',
            'text/plain',
            'application/vnd.google-apps.spreadsheet',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
        }
        allowed_extensions = {'.csv', '.xlsx', '.xls'}

        page_token = None
        page_count = 0
        max_pages = 10  # Safety limit

        try:
            while page_count < max_pages:
                page_count += 1
                logger.info(f"Fetching page {page_count}...")

                params = {"max_results": 100}
                if page_token:
                    params["page_token"] = page_token

                result = toolset.execute_action(
                    action="GOOGLEDRIVE_LIST_FILES",
                    params=params,
                )

                if isinstance(result, dict):
                    data = result.get("data", result)
                    file_list = data.get("files", data.get("items", []))
                    logger.info(f"  Got {len(file_list)} files in this page")

                    for f in file_list:
                        file_id = f.get("id")
                        name = f.get("name", "")
                        mime = f.get("mimeType", "")

                        # Skip folders
                        if mime == "application/vnd.google-apps.folder":
                            continue

                        # Check if it's a spreadsheet/CSV by mime type or extension
                        is_allowed = (
                            mime in allowed_mimes or
                            any(name.lower().endswith(ext) for ext in allowed_extensions)
                        )

                        if file_id and is_allowed:
                            all_files[file_id] = {
                                "id": file_id,
                                "name": name,
                                "mimeType": mime,
                                "modifiedTime": f.get("modifiedTime"),
                            }
                            logger.info(f"  ✅ {name} ({mime})")

                    # Check for more pages
                    page_token = data.get("nextPageToken")
                    if not page_token:
                        logger.info("No more pages")
                        break
                else:
                    logger.warning(f"Unexpected result type: {type(result)}")
                    break

        except Exception as e:
            logger.error(f"Failed to list files: {e}")

        files = list(all_files.values())
        logger.info(f"Total spreadsheet/CSV files found: {len(files)}")

        # Cache the results
        ComposioService._file_cache[cache_key] = files

        return files

    def download_file(self, user_id: str, file_id: str, mime_type: str = "", filename: str = "") -> tuple[str, str]:
        """
        Download a file from Google Drive.
        Returns (filename_without_extension, csv_content).
        """
        if not self.api_key:
            raise ValueError("Composio API key not configured")

        toolset = self._get_toolset(user_id)

        # Try to get file info from cache first
        if not filename or not mime_type:
            file_info = self.get_file_info(user_id, file_id)
            if file_info:
                filename = file_info.get("name", filename or "unknown")
                mime_type = file_info.get("mimeType", mime_type)
            else:
                # Fallback: get metadata via API
                try:
                    result = toolset.execute_action(
                        action="GOOGLEDRIVE_GET_FILE_METADATA",
                        params={"file_id": file_id},
                    )
                    data = result.get("data", result)
                    filename = data.get("name", filename or "unknown")
                    mime_type = data.get("mimeType", mime_type)
                except Exception as e:
                    logger.warning(f"Could not get file metadata: {e}")
                    filename = filename or "unknown"

        logger.info(f"Downloading file: {filename} (mime: {mime_type})")

        # Remove extension from filename for table name
        name_without_ext = filename.rsplit(".", 1)[0] if "." in filename else filename
        # Clean up name for SQL table (replace spaces, special chars)
        table_name = name_without_ext.replace(" ", "_").replace("-", "_").lower()

        # For Google Sheets, use Sheets API to get data as CSV
        if mime_type == "application/vnd.google-apps.spreadsheet":
            logger.info("Using Google Sheets API to read data...")
            result = toolset.execute_action(
                action="GOOGLESHEETS_BATCH_GET",
                params={
                    "spreadsheet_id": file_id,
                    "ranges": ["A1:ZZ10000"]  # Get large range
                },
            )

            # Handle different response formats
            data = result if isinstance(result, dict) else {}
            if data.get("data"):
                data = data["data"]

            if not data.get("valueRanges") and data.get("successful") == False:
                raise Exception(f"Failed to read spreadsheet: {data.get('error')}")

            # Convert to CSV format
            ranges = data.get("valueRanges", [])
            if ranges:
                values = ranges[0].get("values", [])
                csv_lines = []
                for row in values:
                    # Escape commas and quotes in values
                    escaped = []
                    for cell in row:
                        cell_str = str(cell) if cell else ""
                        if "," in cell_str or '"' in cell_str or "\n" in cell_str:
                            cell_str = '"' + cell_str.replace('"', '""') + '"'
                        escaped.append(cell_str)
                    csv_lines.append(",".join(escaped))
                content = "\n".join(csv_lines)
                logger.info(f"Read {len(values)} rows from Google Sheet")
                return table_name, content

            return table_name, ""

        # For CSV and other text files, download directly
        logger.info("Using Google Drive API to download file...")
        result = toolset.execute_action(
            action="GOOGLEDRIVE_DOWNLOAD_FILE",
            params={"file_id": file_id},
        )
        logger.info(f"Download result keys: {result.keys() if isinstance(result, dict) else type(result)}")

        # Handle different response formats
        data = result if isinstance(result, dict) else {}
        if data.get("data"):
            data = data["data"]

        if data.get("successful") == False:
            raise Exception(f"Failed to download file: {data.get('error')}")

        # Try different keys where content might be stored
        content = ""
        possible_keys = ["downloaded_file_content", "content", "file_content", "text", "body"]
        for key in possible_keys:
            if data.get(key):
                content = data[key]
                logger.info(f"Found content in key: {key}")
                break

        # If no content found, log available keys for debugging
        if not content:
            logger.warning(f"No content found. Available keys: {list(data.keys())}")
            logger.warning(f"Data preview: {str(data)[:500]}")

        # Check if content is a file path (Composio saves to disk)
        if content and isinstance(content, str) and content.startswith("/"):
            logger.info(f"Content is a file path: {content}")
            # It's a file path, read the file with encoding fallback
            try:
                with open(content, "r", encoding="utf-8") as f:
                    content = f.read()
                logger.info(f"Read {len(content)} bytes from file")
            except UnicodeDecodeError:
                # Try latin-1 which can read any byte sequence
                try:
                    with open(content, "r", encoding="latin-1") as f:
                        content = f.read()
                    logger.info(f"Read {len(content)} bytes from file (latin-1 encoding)")
                except Exception as e:
                    logger.error(f"Failed to read file with fallback encoding: {e}")
            except Exception as e:
                logger.error(f"Failed to read file: {e}")

        logger.info(f"Downloaded content length: {len(content) if content else 0}")
        return table_name, content
