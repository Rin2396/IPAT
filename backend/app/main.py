from contextlib import asynccontextmanager
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, users, companies, periods, assignments, tasks, reports, notifications
from app.core.config import settings
from app.services.minio_client import get_minio_client, ensure_bucket


class NoCacheMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
        return response


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        client = get_minio_client()
        ensure_bucket(client, settings.MINIO_BUCKET)
    except Exception:
        pass
    yield


app = FastAPI(
    title="IPAT API",
    description="Digital platform for managing industrial practice in college",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(NoCacheMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(companies.router, prefix="/api/companies", tags=["companies"])
app.include_router(periods.router, prefix="/api/periods", tags=["periods"])
app.include_router(assignments.router, prefix="/api/assignments", tags=["assignments"])
app.include_router(tasks.router, prefix="/api/tasks", tags=["tasks"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["notifications"])


@app.get("/api/health")
def health():
    return {"status": "ok"}
