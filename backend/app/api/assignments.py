from fastapi import APIRouter, HTTPException, status, Query

from sqlalchemy.orm import joinedload

from app.core.assignment_access import scope_assignments_query, user_can_access_assignment
from app.core.deps import AdminUser, DbSession, CurrentUser
from app.models.assignment import Assignment, AssignmentStatus
from app.models.user import User, UserRole
from app.tasks.notifications import notify_user
from app.schemas.assignment import (
    AssignmentCreate,
    AssignmentGradeUpdate,
    AssignmentRead,
    AssignmentUpdate,
)

router = APIRouter()


@router.get("", response_model=list[AssignmentRead])
def list_assignments(
    db: DbSession,
    current_user: CurrentUser,
    status_filter: AssignmentStatus | None = Query(None, alias="status"),
    student_id: int | None = Query(None),
    period_id: int | None = Query(None),
    group_id: int | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
):
    q = scope_assignments_query(db, current_user).options(
        joinedload(Assignment.student).joinedload(User.student_group)
    )
    if status_filter is not None:
        q = q.filter(Assignment.status == status_filter)
    if student_id is not None and current_user.role == UserRole.admin:
        q = q.filter(Assignment.student_id == student_id)
    if period_id is not None:
        q = q.filter(Assignment.period_id == period_id)
    if group_id is not None:
        q = q.join(User, Assignment.student_id == User.id).filter(User.student_group_id == group_id)
    return q.order_by(Assignment.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/{assignment_id}", response_model=AssignmentRead)
def get_assignment(assignment_id: int, db: DbSession, current_user: CurrentUser):
    assignment = (
        db.query(Assignment)
        .options(joinedload(Assignment.student).joinedload(User.student_group))
        .filter(Assignment.id == assignment_id)
        .first()
    )
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")
    if not user_can_access_assignment(assignment, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    return assignment


@router.post("", response_model=AssignmentRead, status_code=status.HTTP_201_CREATED)
def create_assignment(data: AssignmentCreate, db: DbSession, current_user: AdminUser):
    assignment = Assignment(
        student_id=data.student_id,
        company_id=data.company_id,
        period_id=data.period_id,
        college_supervisor_id=data.college_supervisor_id,
        company_supervisor_id=data.company_supervisor_id,
        status=AssignmentStatus.draft,
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return (
        db.query(Assignment)
        .options(joinedload(Assignment.student).joinedload(User.student_group))
        .filter(Assignment.id == assignment.id)
        .first()
    )


@router.patch("/{assignment_id}", response_model=AssignmentRead)
def update_assignment(
    assignment_id: int,
    data: AssignmentUpdate,
    db: DbSession,
    current_user: AdminUser,
):
    assignment = db.query(Assignment).with_for_update().filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")
    if data.college_supervisor_id is not None:
        assignment.college_supervisor_id = data.college_supervisor_id
    if data.company_supervisor_id is not None:
        assignment.company_supervisor_id = data.company_supervisor_id
    if data.status is not None:
        old_status = assignment.status
        assignment.status = data.status
        if old_status != data.status:
            notify_user.delay(
                assignment.student_id,
                "Статус назначения изменён",
                f"Назначение #{assignment.id} переведено в статус «{data.status.value}».",
            )
    db.commit()
    return (
        db.query(Assignment)
        .options(joinedload(Assignment.student).joinedload(User.student_group))
        .filter(Assignment.id == assignment_id)
        .first()
    )


@router.patch("/{assignment_id}/grade", response_model=AssignmentRead)
def update_assignment_grade(
    assignment_id: int,
    data: AssignmentGradeUpdate,
    db: DbSession,
    current_user: CurrentUser,
):
    if current_user.role != UserRole.college_supervisor:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only college supervisor can set grade")
    assignment = (
        db.query(Assignment)
        .options(joinedload(Assignment.student).joinedload(User.student_group))
        .filter(Assignment.id == assignment_id)
        .first()
    )
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")
    if assignment.college_supervisor_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    if assignment.status != AssignmentStatus.completed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Grade can only be set after the assignment is completed",
        )
    assignment.college_grade = data.college_grade
    db.commit()
    db.refresh(assignment)
    notify_user.delay(
        assignment.student_id,
        "Выставлена оценка за практику",
        f"По назначению #{assignment.id} руководитель выставил оценку {data.college_grade} из 10.",
    )
    return assignment


@router.delete("/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_assignment(assignment_id: int, db: DbSession, current_user: AdminUser):
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")
    if assignment.status != AssignmentStatus.draft:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Can only delete draft assignments")
    db.delete(assignment)
    db.commit()
