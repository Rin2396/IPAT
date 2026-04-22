from fastapi import APIRouter, Depends, HTTPException, status, Query

from app.core.deps import AdminUser, DbSession, CurrentUser
from app.models.assignment import Assignment
from app.models.task import Task, TaskStatus
from app.tasks.notifications import notify_user
from app.models.user import UserRole
from app.schemas.task import TaskCreate, TaskRead, TaskUpdate

router = APIRouter()

ALLOWED_TRANSITIONS = {
    TaskStatus.todo: (TaskStatus.in_progress,),
    TaskStatus.in_progress: (TaskStatus.done, TaskStatus.todo),
    TaskStatus.done: (TaskStatus.accepted, TaskStatus.in_progress),
    TaskStatus.accepted: (),
}


def _can_access_assignment(assignment: Assignment, user) -> bool:
    if user.role == UserRole.admin:
        return True
    if assignment.student_id == user.id:
        return True
    if assignment.college_supervisor_id == user.id or assignment.company_supervisor_id == user.id:
        return True
    return False


def _can_accept_task(user) -> bool:
    return user.role in (UserRole.admin, UserRole.college_supervisor, UserRole.company_supervisor)


def _allowed_transitions_for_task(task: Task, assignment: Assignment, user) -> list[TaskStatus]:
    # Start from status graph, then apply role-specific constraints.
    transitions = list(ALLOWED_TRANSITIONS.get(task.status, ()))
    if TaskStatus.accepted in transitions:
        # Only supervisors/admin can accept, and only from done (graph already models this).
        if not _can_accept_task(user) or task.status != TaskStatus.done:
            transitions = [t for t in transitions if t != TaskStatus.accepted]
    return transitions


@router.get("", response_model=list[TaskRead])
def list_tasks(
    db: DbSession,
    current_user: CurrentUser,
    assignment_id: int = Query(...),
):
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")
    if not _can_access_assignment(assignment, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    tasks = db.query(Task).filter(Task.assignment_id == assignment_id).order_by(Task.order, Task.id).all()
    # Inject allowed transitions for current user.
    for t in tasks:
        setattr(t, "allowed_transitions", _allowed_transitions_for_task(t, assignment, current_user))
    return tasks


@router.get("/{task_id}", response_model=TaskRead)
def get_task(task_id: int, db: DbSession, current_user: CurrentUser):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    assignment = db.query(Assignment).filter(Assignment.id == task.assignment_id).first()
    if not assignment or not _can_access_assignment(assignment, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    setattr(task, "allowed_transitions", _allowed_transitions_for_task(task, assignment, current_user))
    return task


@router.post("", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
def create_task(
    data: TaskCreate,
    db: DbSession,
    current_user: CurrentUser,
    assignment_id: int = Query(...),
):
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")
    if not _can_access_assignment(assignment, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    if current_user.role == UserRole.student and assignment.student_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    max_order = db.query(Task).filter(Task.assignment_id == assignment_id).count()
    task = Task(
        assignment_id=assignment_id,
        title=data.title,
        description=data.description,
        status=TaskStatus.todo,
        order=data.order if data.order is not None else max_order,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    setattr(task, "allowed_transitions", _allowed_transitions_for_task(task, assignment, current_user))
    return task


@router.patch("/{task_id}", response_model=TaskRead)
def update_task(task_id: int, data: TaskUpdate, db: DbSession, current_user: CurrentUser):
    task = db.query(Task).with_for_update().filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    assignment = db.query(Assignment).filter(Assignment.id == task.assignment_id).first()
    if not assignment or not _can_access_assignment(assignment, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    if data.title is not None:
        task.title = data.title
    if data.description is not None:
        task.description = data.description
    if data.order is not None:
        task.order = data.order
    if data.status is not None:
        allowed = ALLOWED_TRANSITIONS.get(task.status, ())
        if data.status not in allowed and data.status != task.status:
            if data.status == TaskStatus.accepted:
                if not _can_accept_task(current_user):
                    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only supervisor can accept")
                if task.status != TaskStatus.done:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Task must be done before accept")
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot transition from {task.status} to {data.status}",
                )
        task.status = data.status
        if assignment.student_id:
            notify_user.delay(
                assignment.student_id,
                "Статус задачи изменён",
                f"Задача «{task.title}» переведена в статус «{data.status.value}».",
            )
    db.commit()
    db.refresh(task)
    setattr(task, "allowed_transitions", _allowed_transitions_for_task(task, assignment, current_user))
    return task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: int, db: DbSession, current_user: CurrentUser):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    assignment = db.query(Assignment).filter(Assignment.id == task.assignment_id).first()
    if not assignment or not _can_access_assignment(assignment, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    if current_user.role == UserRole.student and assignment.student_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    db.delete(task)
    db.commit()
