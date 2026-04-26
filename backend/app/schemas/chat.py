from datetime import datetime
from pydantic import BaseModel, Field

from app.schemas.user import UserPublicRead


class ChatThreadRead(BaseModel):
    id: int
    assignment_id: int
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatMessageRead(BaseModel):
    id: int
    thread_id: int
    author_id: int
    author: UserPublicRead | None = None
    body: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatMessageCreate(BaseModel):
    body: str = Field(..., min_length=1, max_length=2000)


class ChatReadUpdate(BaseModel):
    last_read_message_id: int | None = None


class ChatUnreadCountRead(BaseModel):
    assignment_id: int
    unread: int

