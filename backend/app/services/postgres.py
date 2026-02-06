import re
import io
import psycopg2
import pandas as pd


class PostgresService:
    def __init__(self, db_url: str):
        self.db_url = db_url

    def _get_connection(self):
        """Get a connection to the Postgres database."""
        return psycopg2.connect(self.db_url)

    def _extract_table_names(self, ddl: str) -> list[str]:
        """Extract table names from DDL."""
        pattern = r'CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)'
        matches = re.findall(pattern, ddl, re.IGNORECASE)
        return matches

    def create_tables(self, ddl: str) -> list[str]:
        """Create tables from DDL, dropping existing tables first."""
        tables = self._extract_table_names(ddl)

        conn = self._get_connection()
        try:
            with conn.cursor() as cur:
                # Drop tables in reverse order (handles FK dependencies)
                for table in reversed(tables):
                    cur.execute(f"DROP TABLE IF EXISTS {table} CASCADE;")

                # Create tables
                cur.execute(ddl)

            conn.commit()
            return tables
        finally:
            conn.close()

    def insert_csv_data(self, table_name: str, csv_content: str) -> int:
        """Insert CSV data into a table. Returns number of rows inserted."""
        df = pd.read_csv(io.StringIO(csv_content))

        if df.empty:
            return 0

        conn = self._get_connection()
        try:
            with conn.cursor() as cur:
                # Get actual column names from the table in order
                cur.execute(f"""
                    SELECT column_name FROM information_schema.columns
                    WHERE table_name = %s
                    ORDER BY ordinal_position
                """, (table_name.lower(),))
                db_columns = [r[0] for r in cur.fetchall()]

                csv_columns = df.columns.tolist()

                # If column counts match, use positional mapping
                if len(csv_columns) == len(db_columns):
                    mapped_cols = db_columns
                else:
                    # Try to map by name
                    column_mapping = {}
                    used_db_cols = set()
                    for csv_col in csv_columns:
                        csv_clean = re.sub(r'\.\d+$', '', csv_col).lower().strip()
                        for db_col in db_columns:
                            if db_col in used_db_cols:
                                continue
                            if db_col.lower() == csv_clean or db_col.lower() == csv_col.lower():
                                column_mapping[csv_col] = db_col
                                used_db_cols.add(db_col)
                                break
                    mapped_cols = [column_mapping.get(c, c.lower()) for c in csv_columns]

                placeholders = ", ".join(["%s"] * len(mapped_cols))
                quoted_columns = [f'"{col}"' for col in mapped_cols]
                column_names = ", ".join(quoted_columns)
                insert_sql = f'INSERT INTO "{table_name}" ({column_names}) VALUES ({placeholders})'

                for _, row in df.iterrows():
                    values = [None if pd.isna(v) else v for v in row.tolist()]
                    cur.execute(insert_sql, values)

            conn.commit()
            return len(df)
        finally:
            conn.close()

    def verify_data(self, table_name: str) -> dict:
        """Verify data in a table."""
        conn = self._get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(f"SELECT COUNT(*) FROM {table_name}")
                count = cur.fetchone()[0]

                cur.execute(f"SELECT * FROM {table_name} LIMIT 3")
                sample = cur.fetchall()

                return {"count": count, "sample": sample}
        finally:
            conn.close()

    def execute_query(self, sql: str) -> tuple[list[str], list[list]]:
        """Execute a SQL query and return columns and rows."""
        conn = self._get_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(sql)
                columns = [desc[0] for desc in cur.description] if cur.description else []
                rows = cur.fetchall()
                # Convert to list of lists for JSON serialization
                rows = [list(row) for row in rows]
                return columns, rows
        finally:
            conn.close()

    def list_tables(self) -> list[dict]:
        """List all tables with row counts."""
        conn = self._get_connection()
        try:
            with conn.cursor() as cur:
                # Get all tables
                cur.execute("""
                    SELECT table_name
                    FROM information_schema.tables
                    WHERE table_schema = 'public'
                    ORDER BY table_name
                """)
                tables = []
                for (table_name,) in cur.fetchall():
                    # Get row count
                    cur.execute(f'SELECT COUNT(*) FROM "{table_name}"')
                    count = cur.fetchone()[0]
                    tables.append({"name": table_name, "row_count": count})
                return tables
        finally:
            conn.close()
