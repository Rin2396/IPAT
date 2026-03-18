from datetime import datetime
from pydantic import BaseModel

from app.models.report import ReportStatus


class ReportBase(BaseModel):
    iteration: int = 1
    status: ReportStatus = ReportStatus.draft


class ReportCreate(BaseModel):
    assignment_id: int
    iteration: int = 1


class ReportUpdate(BaseModel):
    status: ReportStatus | None = None


class ReportRead(BaseModel):
    id: int
    assignment_id: int
    iteration: int
    file_key: str
    status: ReportStatus
    uploaded_at: datetime

    model_config = {"from_attributes": True}


class PresignedUrlRead(BaseModel):
    url: str
    expires_in: int
