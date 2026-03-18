from pydantic import BaseModel


class CompanyBase(BaseModel):
    name: str
    inn: str | None = None
    description: str | None = None


class CompanyCreate(CompanyBase):
    pass


class CompanyUpdate(BaseModel):
    name: str | None = None
    inn: str | None = None
    description: str | None = None


class CompanyRead(BaseModel):
    id: int
    name: str
    inn: str | None
    description: str | None
    verified: bool
    blocked: bool

    model_config = {"from_attributes": True}
