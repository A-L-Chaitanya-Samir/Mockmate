import os
from uuid import uuid4
import pytest
from app.core.config import settings
from app.core.db import transaction
from app.core.auth import identity
from app.main import app
from fastapi.testclient import TestClient


@pytest.fixture
def db():
    if not os.getenv('TEST_DATABASE_URL'):
        pytest.skip('TEST_DATABASE_URL required for PostgreSQL integration tests')
    settings().database_url = os.environ['TEST_DATABASE_URL']
    with transaction() as conn:
        conn.execute('TRUNCATE auth.users CASCADE')
    yield


@pytest.fixture
def accounts(db):
    users = [uuid4(), uuid4()]
    with transaction() as conn:
        for user in users:
            conn.execute('INSERT INTO auth.users(id) VALUES(%s)', (user,))
    return users


@pytest.fixture
def client(accounts):
    app.dependency_overrides[identity] = lambda: accounts[0]
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()
