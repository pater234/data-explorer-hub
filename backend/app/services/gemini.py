from google import genai
import logging
import time

logger = logging.getLogger(__name__)


class GeminiService:
    def __init__(
        self,
        api_key: str = "",
        project_id: str = "",
        location: str = "us-central1",
        use_vertex_ai: bool = False
    ):
        logger.info(f"Initializing GeminiService (use_vertex_ai={use_vertex_ai}, project_id={project_id})")

        if use_vertex_ai and project_id:
            # Use Vertex AI (GCP) - uses ADC or service account
            logger.info(f"Using Vertex AI with project={project_id}, location={location}")
            self.client = genai.Client(
                vertexai=True,
                project=project_id,
                location=location
            )
        elif api_key:
            # Use Google AI Studio
            logger.info("Using Google AI Studio with API key")
            self.client = genai.Client(api_key=api_key)
        else:
            raise ValueError("Either api_key or (use_vertex_ai + project_id) must be provided")

        logger.info("GeminiService initialized successfully")

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
        logger.info(f"Building prompt for {len(csv_data)} CSV files...")
        prompt = self._build_prompt(csv_data)
        logger.info(f"Prompt length: {len(prompt)} chars")

        # Try multiple models with retry for rate limits
        models_to_try = ["gemini-2.0-flash", "gemini-1.5-flash"]
        max_retries = 3

        for model in models_to_try:
            for attempt in range(max_retries):
                logger.info(f"Calling Gemini API (model={model}, attempt {attempt + 1})...")
                try:
                    response = self.client.models.generate_content(
                        model=model,
                        contents=prompt
                    )
                    logger.info("Gemini API call successful!")
                    logger.info(f"Response length: {len(response.text)} chars")
                    return self._clean_ddl(response.text)
                except Exception as e:
                    error_str = str(e)
                    if "429" in error_str or "RESOURCE_EXHAUSTED" in error_str:
                        wait_time = (attempt + 1) * 5  # 5, 10, 15 seconds
                        logger.warning(f"Rate limited, waiting {wait_time}s before retry...")
                        time.sleep(wait_time)
                    else:
                        logger.error(f"Gemini API call failed: {error_str}")
                        raise

        raise Exception("All Gemini API attempts failed due to rate limiting. Please wait a minute and try again.")
