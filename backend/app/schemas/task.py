from datetime import datetime
from pydantic import BaseModel

from app.models.task import TaskStatus


class TaskBase(BaseModel):
    title: str
    description: str | None = None
    status: TaskStatus = TaskStatus.todo
    order: int = 0


class TaskCreate(BaseModel):
    title: str
    description: str | None = None
    order: int = 0


class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    status: TaskStatus | None = None
    order: int | None = None


class TaskRead(BaseModel):
    id: int
    assignment_id: int
    title: str
    description: str | None
    status: TaskStatus
    allowed_transitions: list[TaskStatus] = []
    order: int
    created_at: datetime

    model_config = {"from_attributes": True}
