from pydantic import BaseModel, EmailStr, Field

from app.models.user import UserRole


class StudentGroupBrief(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}


class CompanyBrief(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}


class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: UserRole
    is_active: bool = True


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: UserRole
    is_active: bool = True
    student_group_id: int | None = None
    company_id: int | None = None


class UserUpdate(BaseModel):
    full_name: str | None = None
    role: UserRole | None = None
    is_active: bool | None = None
    student_group_id: int | None = None
    company_id: int | None = None


class UserRead(BaseModel):
    id: int
    email: str
    full_name: str
    role: UserRole
    is_active: bool
    student_group_id: int | None = None
    company_id: int | None = None
    student_group: StudentGroupBrief | None = None
    supervisor_company: CompanyBrief | None = None

    model_config = {"from_attributes": True}


class UserPublicRead(BaseModel):
    id: int
    full_name: str
    role: UserRole
    student_group: StudentGroupBrief | None = None

    model_config = {"from_attributes": True}
