from composio import Composio


class ComposioService:
    def __init__(self, api_key: str, auth_config_id: str, drive_auth_config_id: str = ""):
        self.api_key = api_key
        self.auth_config_id = auth_config_id
        self.drive_auth_config_id = drive_auth_config_id or auth_config_id
        self.sdk = Composio(api_key=api_key) if api_key else None

    def is_connected(self, user_id: str, require_drive: bool = True) -> bool:
        """Check if user has connected their Google Sheets/Drive."""
        if not self.sdk:
            return False

        try:
            accounts = self.sdk.client.connected_accounts.list()
            has_drive = False
            has_sheets = False
            for acc in accounts.items:
                if acc.user_id != user_id:
                    continue
                if acc.status != "ACTIVE":
                    continue
                toolkit_slug = acc.toolkit.slug if acc.toolkit else ""
                if toolkit_slug == "googledrive":
                    has_drive = True
                if toolkit_slug == "googlesheets":
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
        result = self.sdk.client.link.create(
            auth_config_id=config_id,
            user_id=user_id,
            callback_url=f"{redirect_url}/auth/callback",
        )
        return result.redirect_url

    def list_spreadsheet_files(self, user_id: str) -> list[dict]:
        """List CSV and spreadsheet files from user's Google Drive."""
        if not self.sdk:
            raise ValueError("Composio API key not configured")

        result = self.sdk.tools.execute(
            slug="GOOGLEDRIVE_FIND_FILE",
            arguments={
                "search_query": "mimeType='text/csv' or mimeType='application/vnd.google-apps.spreadsheet' or mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'",
                "max_results": 50,
            },
            user_id=user_id,
            dangerously_skip_version_check=True,
        )

        files = []
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

        return files

    def download_file(self, user_id: str, file_id: str, mime_type: str = "") -> tuple[str, str]:
        """
        Download a file from Google Drive.
        Returns (filename_without_extension, csv_content).
        """
        if not self.sdk:
            raise ValueError("Composio API key not configured")

        # Get file info from our cached file list
        files = self.list_spreadsheet_files(user_id)
        filename = "unknown"
        for f in files:
            if f.get("id") == file_id:
                filename = f.get("name", "unknown")
                mime_type = f.get("mimeType", mime_type)
                break

        # Remove extension from filename for table name
        name_without_ext = filename.rsplit(".", 1)[0] if "." in filename else filename
        # Clean up name for SQL table (replace spaces, special chars)
        table_name = name_without_ext.replace(" ", "_").replace("-", "_").lower()

        # For Google Sheets, use Sheets API to get data as CSV
        if mime_type == "application/vnd.google-apps.spreadsheet":
            result = self.sdk.tools.execute(
                slug="GOOGLESHEETS_BATCH_GET",
                arguments={
                    "spreadsheet_id": file_id,
                    "ranges": ["A1:ZZ10000"]  # Get large range
                },
                user_id=user_id,
                dangerously_skip_version_check=True,
            )

            if not result.get("successful"):
                raise Exception(f"Failed to read spreadsheet: {result.get('error')}")

            # Convert to CSV format
            data = result.get("data", {})
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
                return table_name, content

            return table_name, ""

        # For regular files (CSV), download directly
        result = self.sdk.tools.execute(
            slug="GOOGLEDRIVE_DOWNLOAD_FILE",
            arguments={"file_id": file_id},
            user_id=user_id,
            dangerously_skip_version_check=True,
        )

        if not result.get("successful"):
            raise Exception(f"Failed to download file: {result.get('error')}")

        # Check if content is a file path (Composio saves to disk)
        content = result.get("data", {}).get("downloaded_file_content", "")
        if content and content.startswith("/"):
            # It's a file path, read the file
            try:
                with open(content, "r") as f:
                    content = f.read()
            except Exception:
                pass

        return table_name, content
