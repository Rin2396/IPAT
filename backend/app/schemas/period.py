from datetime import date
from pydantic import BaseModel


class PeriodBase(BaseModel):
    name: str
    start_date: date
    end_date: date
    is_active: bool = True


class PeriodCreate(PeriodBase):
    pass


class PeriodUpdate(BaseModel):
    name: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    is_active: bool | None = None


class PeriodRead(BaseModel):
    id: int
    name: str
    start_date: date
    end_date: date
    is_active: bool

    model_config = {"from_attributes": True}
