"""Shared rules for who can see or modify data tied to an assignment."""

from sqlalchemy.orm import Session

from app.models.assignment import Assignment
from app.models.user import User, UserRole


def user_can_access_assignment(assignment: Assignment, user: User) -> bool:
    if user.role == UserRole.admin:
        return True
    if assignment.student_id == user.id:
        return True
    if assignment.college_supervisor_id == user.id:
        return True
    if assignment.company_supervisor_id == user.id:
        return True
    if user.role == UserRole.company_supervisor and user.company_id and assignment.company_id == user.company_id:
        return True
    return False


def scope_assignments_query(db: Session, user: User):
    q = db.query(Assignment)
    if user.role == UserRole.admin:
        pass
    elif user.role == UserRole.student:
        q = q.filter(Assignment.student_id == user.id)
    elif user.role == UserRole.college_supervisor:
        q = q.filter(Assignment.college_supervisor_id == user.id)
    elif user.role == UserRole.company_supervisor:
        if user.company_id:
            q = q.filter(Assignment.company_id == user.company_id)
        else:
            q = q.filter(Assignment.company_supervisor_id == user.id)
    else:
        q = q.filter(Assignment.id == -1)
    return q
