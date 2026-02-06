# Data Infrastructure Migration Agent - Phase 1

## Current Goal
Test if Gemini can parse spreadsheets and infer correct database schemas with relationships.

## What We're Testing
Can Gemini look at 2-3 related CSV files and figure out:
- Correct SQL data types for each column
- Primary keys
- Foreign key relationships between tables
- Generate valid Postgres DDL

## Setup Steps
1. Create virtual environment and install: `google-generativeai`, `pandas`, `openpyxl`
2. Get Gemini API key from https://aistudio.google.com/app/apikey
3. Create sample CSVs: customers, orders, products with obvious relationships
4. Run test script to see what Gemini outputs

## What Success Looks Like
- Gemini correctly identifies customer_id in orders table links to customers
- Reasonable data types (VARCHAR for names, DECIMAL for prices, etc.)
- Valid SQL syntax
- Appropriate NOT NULL constraints

## What Could Go Wrong
- Misses obvious foreign key relationships
- Wrong data types (stores money as INTEGER)
- Generic types everywhere (just "TEXT")
- Invalid SQL syntax

## Next Phase (After This Works)
1. Actually insert data into a real Postgres DB
2. Build validation (compare old spreadsheet vs new DB)
3. Add Composio for Google Drive
4. Build simple frontend
5. Deploy

## Files Needed
- `test_schema_inference.py` - main test script
- `sample_data/` folder with 3 CSVs
- `requirements.txt`

## Environment
```bash
GEMINI_API_KEY=your-key-here
```

## Context for Claude
We're at a hackathon building an agent that migrates companies from messy spreadsheets to proper databases. Before we build the full system, we need to validate that Gemini can actually infer schemas correctly. This is the critical first test.