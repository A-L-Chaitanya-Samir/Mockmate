"""Applies external-service test stubs, then the actual migration to EMPTY test Postgres."""
import os
from pathlib import Path
import psycopg

with psycopg.connect(os.environ['TEST_DATABASE_URL']) as conn:
    conn.execute(Path('backend/tests/bootstrap.sql').read_text())
    for file in sorted(Path('supabase/migrations').glob('*.sql')):
        conn.execute(file.read_text())
