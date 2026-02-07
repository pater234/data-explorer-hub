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

    def create_tables(self, ddl: str) -> tuple[list[str], list[tuple]]:
        """Create tables from DDL, dropping existing tables first.
        Returns (table_names, fk_constraints) - FKs should be added after data insertion.
        """
        tables = self._extract_table_names(ddl)

        # Split DDL into individual statements
        statements = [s.strip() for s in ddl.split(';') if s.strip()]

        # Separate CREATE TABLE statements and extract FK info
        create_statements = []
        fk_alters = []

        for stmt in statements:
            if not re.match(r'CREATE\s+TABLE', stmt, re.IGNORECASE):
                continue

            # Extract table name
            table_match = re.search(r'CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[""]?(\w+)[""]?', stmt, re.IGNORECASE)
            if not table_match:
                continue
            table_name = table_match.group(1)

            # Find and extract FOREIGN KEY constraints
            fk_pattern = r'FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+[""]?(\w+)[""]?\s*\(([^)]+)\)(?:\s+ON\s+(?:DELETE|UPDATE)\s+(?:CASCADE|SET\s+NULL|NO\s+ACTION|RESTRICT))*'
            fk_matches = re.findall(fk_pattern, stmt, re.IGNORECASE)

            for fk_col, ref_table, ref_col in fk_matches:
                fk_alters.append((table_name, fk_col.strip().strip('"'), ref_table, ref_col.strip().strip('"')))

            # Remove FK constraints from the CREATE statement line by line
            lines = stmt.split('\n')
            clean_lines = []
            for line in lines:
                # Skip lines that are FK constraints
                if re.search(r'^\s*,?\s*FOREIGN\s+KEY', line, re.IGNORECASE):
                    continue
                clean_lines.append(line)

            stmt_no_fk = '\n'.join(clean_lines)

            # Clean up trailing commas before )
            stmt_no_fk = re.sub(r',(\s*)\)', r'\1)', stmt_no_fk)

            # Make sure statement ends with )
            stmt_no_fk = stmt_no_fk.strip()
            if not stmt_no_fk.endswith(')'):
                stmt_no_fk += ')'

            create_statements.append(stmt_no_fk)

        conn = self._get_connection()
        try:
            with conn.cursor() as cur:
                # Drop tables in reverse order (handles FK dependencies)
                for table in reversed(tables):
                    cur.execute(f'DROP TABLE IF EXISTS "{table}" CASCADE;')

                # Create tables without FK constraints
                for stmt in create_statements:
                    # Clean up the statement - normalize whitespace
                    stmt = ' '.join(stmt.split())
                    print(f"DEBUG executing: {stmt}")
                    try:
                        cur.execute(stmt + ';')
                    except Exception as e:
                        print(f"Error creating table: {e}")
                        print(f"Statement repr: {repr(stmt)}")
                        raise

            conn.commit()
            return tables, fk_alters
        finally:
            conn.close()

    def add_foreign_keys(self, fk_constraints: list[tuple]) -> list[str]:
        """Add foreign key constraints after data is inserted."""
        added = []
        conn = self._get_connection()
        try:
            with conn.cursor() as cur:
                for table_name, fk_col, ref_table, ref_col in fk_constraints:
                    try:
                        alter_sql = f'ALTER TABLE "{table_name}" ADD FOREIGN KEY ("{fk_col}") REFERENCES "{ref_table}" ("{ref_col}");'
                        cur.execute(alter_sql)
                        added.append(f"{table_name}.{fk_col} -> {ref_table}.{ref_col}")
                    except Exception as e:
                        print(f"Warning: Could not add FK {table_name}.{fk_col} -> {ref_table}.{ref_col}: {e}")
            conn.commit()
            return added
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
