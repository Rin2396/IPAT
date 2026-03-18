from datetime import datetime
from pydantic import BaseModel


class NotificationRead(BaseModel):
    id: int
    user_id: int
    title: str
    body: str | None
    read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationMarkRead(BaseModel):
    read: bool = True
