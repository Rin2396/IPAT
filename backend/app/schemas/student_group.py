from datetime import datetime

from pydantic import BaseModel, Field


class StudentGroupBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)


class StudentGroupCreate(StudentGroupBase):
    pass


class StudentGroupUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)


class StudentGroupRead(BaseModel):
    id: int
    name: str
    created_at: datetime

    model_config = {"from_attributes": True}


class StudentGroupMembersAdd(BaseModel):
    user_ids: list[int] = Field(default_factory=list, min_length=1)
