from fastapi import APIRouter, Depends, HTTPException, status, Query

from sqlalchemy.orm import joinedload

from app.core.deps import AdminUser, DbSession, CurrentUser
from app.core.security import get_password_hash
from app.models.company import Company
from app.models.student_group import StudentGroup
from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserRead, UserUpdate

router = APIRouter()


def _validate_student_group(db, group_id: int | None) -> None:
    if group_id is None:
        return
    if not db.query(StudentGroup).filter(StudentGroup.id == group_id).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Student group not found")


def _validate_company(db, company_id: int | None) -> None:
    if company_id is None:
        return
    if not db.query(Company).filter(Company.id == company_id).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Company not found")


@router.get("", response_model=list[UserRead])
def list_users(
    db: DbSession,
    current_user: AdminUser,
    role: UserRole | None = Query(None),
    group_id: int | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
):
    q = (
        db.query(User)
        .options(joinedload(User.student_group), joinedload(User.supervisor_company))
        .order_by(User.full_name.asc())
    )
    if role is not None:
        q = q.filter(User.role == role)
    if group_id is not None:
        q = q.filter(User.role == UserRole.student, User.student_group_id == group_id)
    return q.offset(skip).limit(limit).all()


@router.get("/me", response_model=UserRead)
def get_me(db: DbSession, current_user: CurrentUser):
    user = (
        db.query(User)
        .options(joinedload(User.student_group), joinedload(User.supervisor_company))
        .filter(User.id == current_user.id)
        .first()
    )
    return user


@router.get("/{user_id}", response_model=UserRead)
def get_user(user_id: int, db: DbSession, current_user: AdminUser):
    user = (
        db.query(User)
        .options(joinedload(User.student_group), joinedload(User.supervisor_company))
        .filter(User.id == user_id)
        .first()
    )
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user(data: UserCreate, db: DbSession, current_user: AdminUser):
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    if data.student_group_id is not None and data.role != UserRole.student:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="student_group_id is only for students")
    if data.company_id is not None and data.role != UserRole.company_supervisor:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="company_id is only for company supervisors")
    _validate_student_group(db, data.student_group_id)
    _validate_company(db, data.company_id)
    user = User(
        email=data.email,
        hashed_password=get_password_hash(data.password),
        role=data.role,
        full_name=data.full_name,
        is_active=data.is_active,
        student_group_id=data.student_group_id if data.role == UserRole.student else None,
        company_id=data.company_id if data.role == UserRole.company_supervisor else None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return (
        db.query(User)
        .options(joinedload(User.student_group), joinedload(User.supervisor_company))
        .filter(User.id == user.id)
        .first()
    )


@router.patch("/{user_id}", response_model=UserRead)
def update_user(user_id: int, data: UserUpdate, db: DbSession, current_user: AdminUser):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    payload = data.model_dump(exclude_unset=True)
    new_role = payload.get("role", user.role)

    if payload.get("student_group_id") is not None:
        if new_role != UserRole.student:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="student_group_id is only for students")
        _validate_student_group(db, payload["student_group_id"])
    if payload.get("company_id") is not None:
        if new_role != UserRole.company_supervisor:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="company_id is only for company supervisors")
        _validate_company(db, payload["company_id"])

    if "full_name" in payload:
        user.full_name = payload["full_name"]
    if "role" in payload:
        user.role = payload["role"]
        if user.role != UserRole.student:
            user.student_group_id = None
        if user.role != UserRole.company_supervisor:
            user.company_id = None
        new_role = user.role
    if "is_active" in payload:
        user.is_active = payload["is_active"]
    if "student_group_id" in payload:
        user.student_group_id = (
            payload["student_group_id"] if new_role == UserRole.student else None
        )
    if "company_id" in payload:
        user.company_id = (
            payload["company_id"] if new_role == UserRole.company_supervisor else None
        )

    db.commit()
    return (
        db.query(User)
        .options(joinedload(User.student_group), joinedload(User.supervisor_company))
        .filter(User.id == user_id)
        .first()
    )


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, db: DbSession, current_user: AdminUser):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    db.delete(user)
    db.commit()
