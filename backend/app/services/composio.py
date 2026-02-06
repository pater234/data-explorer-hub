from composio import Composio, ComposioToolSet
import logging

logger = logging.getLogger(__name__)


class ComposioService:
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

    def list_spreadsheet_files(self, user_id: str) -> list[dict]:
        """List CSV and spreadsheet files from user's Google Drive."""
        if not self.api_key:
            raise ValueError("Composio API key not configured")

        toolset = self._get_toolset(user_id)
        logger.info("Searching for spreadsheet and CSV files...")
        # Search by mime type OR file extension to catch all spreadsheet/CSV files
        search_query = (
            "mimeType='text/csv' or "
            "mimeType='text/plain' or "
            "mimeType='application/vnd.google-apps.spreadsheet' or "
            "mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or "
            "mimeType='application/vnd.ms-excel' or "
            "name contains '.csv' or "
            "name contains '.xlsx' or "
            "name contains '.xls'"
        )
        logger.info(f"Search query: {search_query}")
        result = toolset.execute_action(
            action="GOOGLEDRIVE_FIND_FILE",
            params={
                "search_query": search_query,
                "max_results": 50,
            },
        )

        files = []
        # Handle different response formats
        if isinstance(result, dict):
            logger.info(f"Search result keys: {result.keys()}")
            if result.get("successful") and result.get("data"):
                data = result["data"]
                file_list = data.get("files", data.get("items", []))
                for f in file_list:
                    files.append({
                        "id": f.get("id"),
                        "name": f.get("name"),
                        "mimeType": f.get("mimeType"),
                        "modifiedTime": f.get("modifiedTime"),
                    })
            elif result.get("files"):
                for f in result["files"]:
                    files.append({
                        "id": f.get("id"),
                        "name": f.get("name"),
                        "mimeType": f.get("mimeType"),
                        "modifiedTime": f.get("modifiedTime"),
                    })

        logger.info(f"Found {len(files)} files:")
        for f in files:
            logger.info(f"  - {f['name']} ({f['mimeType']})")

        return files

    def download_file(self, user_id: str, file_id: str, mime_type: str = "") -> tuple[str, str]:
        """
        Download a file from Google Drive.
        Returns (filename_without_extension, csv_content).
        """
        if not self.api_key:
            raise ValueError("Composio API key not configured")

        toolset = self._get_toolset(user_id)

        # Get file info from our cached file list
        files = self.list_spreadsheet_files(user_id)
        filename = "unknown"
        for f in files:
            if f.get("id") == file_id:
                filename = f.get("name", "unknown")
                mime_type = f.get("mimeType", mime_type)
                break

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
            # It's a file path, read the file
            try:
                with open(content, "r") as f:
                    content = f.read()
                logger.info(f"Read {len(content)} bytes from file")
            except Exception as e:
                logger.error(f"Failed to read file: {e}")

        logger.info(f"Downloaded content length: {len(content) if content else 0}")
        return table_name, content
