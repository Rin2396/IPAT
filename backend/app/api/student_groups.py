from fastapi import APIRouter, HTTPException, status

from sqlalchemy.orm import joinedload

from app.core.assignment_access import scope_assignments_query
from app.core.deps import AdminUser, CurrentUser, DbSession
from app.models.assignment import Assignment
from app.models.student_group import StudentGroup
from app.models.user import User, UserRole
from app.schemas.student_group import (
    StudentGroupCreate,
    StudentGroupMembersAdd,
    StudentGroupRead,
    StudentGroupUpdate,
)
from app.schemas.user import UserRead

router = APIRouter()


@router.get("", response_model=list[StudentGroupRead])
def list_student_groups(db: DbSession, current_user: AdminUser):
    return db.query(StudentGroup).order_by(StudentGroup.name.asc()).all()


@router.get("/context", response_model=list[StudentGroupRead])
def list_student_groups_for_filters(db: DbSession, current_user: CurrentUser):
    """Groups that appear in assignments visible to the current user (for UI filters)."""
    if current_user.role == UserRole.admin:
        return db.query(StudentGroup).order_by(StudentGroup.name.asc()).all()
    if current_user.role not in (UserRole.college_supervisor, UserRole.company_supervisor):
        return []
    q = scope_assignments_query(db, current_user)
    rows = (
        q.join(User, Assignment.student_id == User.id)
        .filter(User.student_group_id.isnot(None))
        .with_entities(User.student_group_id)
        .distinct()
        .all()
    )
    ids = [r[0] for r in rows if r[0] is not None]
    if not ids:
        return []
    return db.query(StudentGroup).filter(StudentGroup.id.in_(ids)).order_by(StudentGroup.name.asc()).all()


@router.post("", response_model=StudentGroupRead, status_code=status.HTTP_201_CREATED)
def create_student_group(data: StudentGroupCreate, db: DbSession, current_user: AdminUser):
    if db.query(StudentGroup).filter(StudentGroup.name == data.name.strip()).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Group name already exists")
    g = StudentGroup(name=data.name.strip())
    db.add(g)
    db.commit()
    db.refresh(g)
    return g


@router.patch("/{group_id}", response_model=StudentGroupRead)
def update_student_group(group_id: int, data: StudentGroupUpdate, db: DbSession, current_user: AdminUser):
    g = db.query(StudentGroup).filter(StudentGroup.id == group_id).first()
    if not g:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
    if data.name is not None:
        name = data.name.strip()
        exists = (
            db.query(StudentGroup)
            .filter(StudentGroup.name == name, StudentGroup.id != group_id)
            .first()
        )
        if exists:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Group name already exists")
        g.name = name
    db.commit()
    db.refresh(g)
    return g


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_student_group(group_id: int, db: DbSession, current_user: AdminUser):
    g = db.query(StudentGroup).filter(StudentGroup.id == group_id).first()
    if not g:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
    db.query(User).filter(User.student_group_id == group_id).update({User.student_group_id: None}, synchronize_session=False)
    db.delete(g)
    db.commit()


@router.get("/{group_id}/members", response_model=list[UserRead])
def list_group_members(group_id: int, db: DbSession, current_user: AdminUser):
    g = db.query(StudentGroup).filter(StudentGroup.id == group_id).first()
    if not g:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
    return (
        db.query(User)
        .options(joinedload(User.student_group), joinedload(User.supervisor_company))
        .filter(User.role == UserRole.student, User.student_group_id == group_id)
        .order_by(User.full_name.asc())
        .all()
    )


@router.post("/{group_id}/members", response_model=list[UserRead])
def add_members_to_group(group_id: int, data: StudentGroupMembersAdd, db: DbSession, current_user: AdminUser):
    g = db.query(StudentGroup).filter(StudentGroup.id == group_id).first()
    if not g:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
    users = db.query(User).filter(User.id.in_(data.user_ids)).all()
    if len(users) != len(set(data.user_ids)):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Some user ids were not found")
    for u in users:
        if u.role != UserRole.student:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"User {u.id} is not a student",
            )
        u.student_group_id = group_id
    db.commit()
    for u in users:
        db.refresh(u)
    return (
        db.query(User)
        .options(joinedload(User.student_group), joinedload(User.supervisor_company))
        .filter(User.role == UserRole.student, User.student_group_id == group_id)
        .order_by(User.full_name.asc())
        .all()
    )
