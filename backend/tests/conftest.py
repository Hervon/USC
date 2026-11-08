from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")
# Container runs inherit the live Redis URL; tests must never populate its cache
# or alter the running application's login counters.
os.environ["REDIS_URL"] = ""
os.environ["RATE_LIMIT_ENABLED"] = "false"

from app.db.schema import metadata
from app.db.deps import get_db
from app.main import app


@pytest.fixture()
def db_session() -> Session:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        future=True,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
        metadata.drop_all(engine)
        engine.dispose()


@pytest.fixture()
def client(db_session: Session) -> TestClient:
    def _get_test_db():
        yield db_session

    app.dependency_overrides[get_db] = _get_test_db
    test_client = TestClient(app)
    try:
        yield test_client
    finally:
        app.dependency_overrides.clear()
