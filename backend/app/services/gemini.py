from google import genai


class GeminiService:
    def __init__(self, api_key: str):
        self.client = genai.Client(api_key=api_key)

    def _build_prompt(self, csv_data: dict[str, str]) -> str:
        """Build the prompt for Gemini with all CSV data."""
        csv_sections = []
        for name, content in csv_data.items():
            csv_sections.append(f"=== {name}.csv ===\n{content}")

        all_csvs = "\n\n".join(csv_sections)

        prompt = f"""You are a database architect. Analyze these CSV files and generate PostgreSQL DDL.

{all_csvs}

Based on this data, generate:
1. CREATE TABLE statements with appropriate data types
2. Primary keys for each table
3. Foreign key constraints where relationships exist between tables
4. Do NOT add NOT NULL constraints except for primary key columns - the sample data may not show all possible null values

Requirements:
- CRITICAL: Copy column names EXACTLY as they appear in the CSV header row. Do NOT modify, rename, or correct column names in any way.
- Wrap ALL column names in double quotes to preserve exact names (e.g., "Code", "10/1 UCLA", "PHQ TOTAL ")
- Be CONSERVATIVE with types - if a column has ANY non-numeric values, use VARCHAR(255) or TEXT
- Only use INTEGER/DECIMAL if ALL values in the column are clearly numeric
- For money/prices, use DECIMAL(10,2)
- Use VARCHAR(255) as the default when uncertain
- Add foreign key constraints where you see obvious relationships
- Use the CSV filename (without extension) as the table name
- If there are duplicate column names, append a number like "Column 2", "Column 3" etc.

Output ONLY valid PostgreSQL DDL. No explanations, just SQL."""

        return prompt

    def _clean_ddl(self, ddl: str) -> str:
        """Clean up markdown code blocks if present."""
        if ddl.startswith("```"):
            lines = ddl.split("\n")
            lines = [l for l in lines if not l.startswith("```")]
            ddl = "\n".join(lines)
        return ddl.strip()

    def infer_schema(self, csv_data: dict[str, str]) -> str:
        """Send CSV data to Gemini and get schema inference."""
        prompt = self._build_prompt(csv_data)

        response = self.client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )

        return self._clean_ddl(response.text)
