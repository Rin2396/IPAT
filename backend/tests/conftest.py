import pytest
from fastapi.testclient import TestClient
from starlette.requests import Request
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool


@pytest.fixture()
def client(monkeypatch: pytest.MonkeyPatch):
    # Use in-memory SQLite for fast, isolated tests.
    # StaticPool keeps the same connection so the schema persists across sessions.
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    # Patch DB globals used by dependencies.
    import app.core.database as database

    monkeypatch.setattr(database, "engine", engine, raising=True)
    monkeypatch.setattr(database, "SessionLocal", TestingSessionLocal, raising=True)

    # Prevent network calls in FastAPI lifespan (MinIO bucket check).
    import app.services.minio_client as minio_client

    monkeypatch.setattr(minio_client, "get_minio_client", lambda: (_ for _ in ()).throw(RuntimeError("minio disabled")), raising=True)

    # Ensure all models are imported so metadata is complete.
    import app.models  # noqa: F401

    database.Base.metadata.create_all(bind=engine)

    from app.main import app
    from app.core.deps import get_current_user
    from app.models.user import User

    # Make sure FastAPI uses our DB session factory.
    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[database.get_db] = override_get_db

    # Bypass JWT/Redis entirely: authenticate via X-Test-User-Id header.
    def override_current_user(request: Request):
        user_id = request.headers.get("X-Test-User-Id")
        if not user_id:
            # Mirror typical auth failure
            from fastapi import HTTPException, status

            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
        db = TestingSessionLocal()
        try:
            user = db.query(User).filter(User.id == int(user_id)).first()
            if not user:
                from fastapi import HTTPException, status

                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
            return user
        finally:
            db.close()

    app.dependency_overrides[get_current_user] = override_current_user

    with TestClient(app) as c:
        yield c

