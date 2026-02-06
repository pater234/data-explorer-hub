#!/usr/bin/env python3
"""
Test Gemini's ability to infer database schemas from CSV files.
"""

import os
from pathlib import Path

from google import genai
from dotenv import load_dotenv

load_dotenv()

# Configure Gemini
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))


def load_csv_files(data_dir: str = "sample_data") -> dict[str, str]:
    """Load all CSV files from the data directory."""
    csv_files = {}
    data_path = Path(data_dir)

    for csv_file in data_path.glob("*.csv"):
        csv_files[csv_file.stem] = csv_file.read_text()

    return csv_files


def build_prompt(csv_data: dict[str, str]) -> str:
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
4. Appropriate NOT NULL constraints based on the data

Requirements:
- Use appropriate PostgreSQL types (VARCHAR, INTEGER, DECIMAL, BOOLEAN, DATE, TIMESTAMP, etc.)
- For money/prices, use DECIMAL(10,2)
- Infer maximum VARCHAR lengths from the data (round up reasonably)
- Add foreign key constraints where you see obvious relationships (e.g., customer_id in orders references customers)

Output ONLY valid PostgreSQL DDL. No explanations, just SQL."""

    return prompt


def infer_schema() -> str:
    """Send CSV data to Gemini and get schema inference."""

    csv_data = load_csv_files()
    print(f"Loaded {len(csv_data)} CSV files: {', '.join(csv_data.keys())}")

    prompt = build_prompt(csv_data)

    print("Sending to Gemini...")
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt
    )

    return response.text


def main():
    print("=" * 60)
    print("Schema Inference Test")
    print("=" * 60)

    ddl = infer_schema()

    # Clean up markdown code blocks if present
    if ddl.startswith("```"):
        lines = ddl.split("\n")
        # Remove first line (```sql) and last line (```)
        lines = [l for l in lines if not l.startswith("```")]
        ddl = "\n".join(lines)

    print("\n" + "=" * 60)
    print("Generated DDL:")
    print("=" * 60)
    print(ddl)

    # Save to file
    output_path = Path("output_schema.sql")
    output_path.write_text(ddl)
    print(f"\nSaved to: {output_path}")

    return ddl


if __name__ == "__main__":
    main()
