#!/usr/bin/env python3
"""
Create tables in Postgres from the generated DDL and insert sample data.
"""

import os
from pathlib import Path

import psycopg2
import pandas as pd
from dotenv import load_dotenv

load_dotenv()


def get_connection():
    """Get a connection to the Postgres database."""
    return psycopg2.connect(os.getenv("RENDER_DB_URL"))


def drop_tables(conn):
    """Drop existing tables if they exist (in correct order for FK constraints)."""
    with conn.cursor() as cur:
        cur.execute("DROP TABLE IF EXISTS orders CASCADE;")
        cur.execute("DROP TABLE IF EXISTS products CASCADE;")
        cur.execute("DROP TABLE IF EXISTS customers CASCADE;")
    conn.commit()
    print("Dropped existing tables")


def create_tables(conn):
    """Create tables from the DDL file."""
    ddl = Path("output_schema.sql").read_text()

    with conn.cursor() as cur:
        cur.execute(ddl)
    conn.commit()
    print("Created tables from output_schema.sql")


def insert_data(conn):
    """Insert sample data from CSV files."""

    # Load CSVs
    customers = pd.read_csv("sample_data/customers.csv")
    products = pd.read_csv("sample_data/products.csv")
    orders = pd.read_csv("sample_data/orders.csv")

    with conn.cursor() as cur:
        # Insert customers
        for _, row in customers.iterrows():
            cur.execute(
                """INSERT INTO customers (customer_id, first_name, last_name, email, phone, created_at)
                   VALUES (%s, %s, %s, %s, %s, %s)""",
                (row['customer_id'], row['first_name'], row['last_name'],
                 row['email'], row['phone'], row['created_at'])
            )
        print(f"Inserted {len(customers)} customers")

        # Insert products
        for _, row in products.iterrows():
            cur.execute(
                """INSERT INTO products (product_id, product_name, description, price, sku, in_stock)
                   VALUES (%s, %s, %s, %s, %s, %s)""",
                (row['product_id'], row['product_name'], row['description'],
                 row['price'], row['sku'], row['in_stock'])
            )
        print(f"Inserted {len(products)} products")

        # Insert orders
        for _, row in orders.iterrows():
            cur.execute(
                """INSERT INTO orders (order_id, customer_id, product_id, quantity, unit_price, total_amount, order_date, status)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
                (row['order_id'], row['customer_id'], row['product_id'],
                 row['quantity'], row['unit_price'], row['total_amount'],
                 row['order_date'], row['status'])
            )
        print(f"Inserted {len(orders)} orders")

    conn.commit()


def verify_data(conn):
    """Verify the data was inserted correctly."""
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM customers")
        print(f"\nVerification:")
        print(f"  customers: {cur.fetchone()[0]} rows")

        cur.execute("SELECT COUNT(*) FROM products")
        print(f"  products: {cur.fetchone()[0]} rows")

        cur.execute("SELECT COUNT(*) FROM orders")
        print(f"  orders: {cur.fetchone()[0]} rows")

        # Test a join to verify FK relationships work
        cur.execute("""
            SELECT c.first_name, c.last_name, p.product_name, o.quantity, o.total_amount
            FROM orders o
            JOIN customers c ON o.customer_id = c.customer_id
            JOIN products p ON o.product_id = p.product_id
            LIMIT 3
        """)
        print("\nSample joined data:")
        for row in cur.fetchall():
            print(f"  {row[0]} {row[1]} ordered {row[3]}x {row[2]} (${row[4]})")


def main():
    print("=" * 60)
    print("Creating Tables in Render Postgres")
    print("=" * 60)

    conn = get_connection()
    print("Connected to database")

    try:
        drop_tables(conn)
        create_tables(conn)
        insert_data(conn)
        verify_data(conn)
        print("\nDone!")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
