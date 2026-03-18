from datetime import datetime
from pydantic import BaseModel

from app.models.assignment import AssignmentStatus


class AssignmentBase(BaseModel):
    student_id: int
    company_id: int
    period_id: int
    college_supervisor_id: int | None = None
    company_supervisor_id: int | None = None
    status: AssignmentStatus = AssignmentStatus.draft


class AssignmentCreate(BaseModel):
    student_id: int
    company_id: int
    period_id: int
    college_supervisor_id: int | None = None
    company_supervisor_id: int | None = None


class AssignmentUpdate(BaseModel):
    college_supervisor_id: int | None = None
    company_supervisor_id: int | None = None
    status: AssignmentStatus | None = None


class AssignmentRead(BaseModel):
    id: int
    student_id: int
    company_id: int
    period_id: int
    college_supervisor_id: int | None
    company_supervisor_id: int | None
    status: AssignmentStatus
    created_at: datetime

    model_config = {"from_attributes": True}
