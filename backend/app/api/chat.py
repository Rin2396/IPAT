from __future__ import annotations

from datetime import datetime, timezone

import redis
from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import joinedload

from app.core.config import settings
from app.core.deps import DbSession, CurrentUser
from app.models.assignment import Assignment
from app.models.chat import ChatThread, ChatMessage, ChatThreadRead
from app.models.user import UserRole
from app.schemas.chat import (
    ChatMessageCreate,
    ChatMessageRead,
    ChatReadUpdate,
    ChatThreadRead as ChatThreadReadSchema,
    ChatUnreadCountRead,
)
from app.tasks.notifications import notify_user

router = APIRouter()

RATE_LIMIT_MAX_PER_MINUTE = 10
NOTIFY_THROTTLE_SECONDS = 120


def _redis_client() -> redis.Redis:
    return redis.from_url(settings.REDIS_URL, decode_responses=True)


def _can_access_assignment(assignment: Assignment, user) -> bool:
    if user.role == UserRole.admin:
        return True
    if assignment.student_id == user.id:
        return True
    if assignment.college_supervisor_id == user.id or assignment.company_supervisor_id == user.id:
        return True
    return False


def _assignment_participants(assignment: Assignment) -> list[int]:
    ids: list[int] = [assignment.student_id]
    if assignment.college_supervisor_id:
        ids.append(assignment.college_supervisor_id)
    if assignment.company_supervisor_id:
        ids.append(assignment.company_supervisor_id)
    return list(dict.fromkeys([i for i in ids if i is not None]))


def _get_or_create_thread(db, assignment_id: int) -> ChatThread:
    thread = db.query(ChatThread).filter(ChatThread.assignment_id == assignment_id).first()
    if thread:
        return thread
    thread = ChatThread(assignment_id=assignment_id)
    db.add(thread)
    db.commit()
    db.refresh(thread)
    return thread


def _rate_limit_or_429(*, user_id: int, thread_id: int) -> None:
    key = f"ratelimit:chat:send:{thread_id}:{user_id}"
    r = _redis_client()
    try:
        # Increment with 60s TTL window.
        n = r.incr(key)
        if n == 1:
            r.expire(key, 60)
        if n > RATE_LIMIT_MAX_PER_MINUTE:
            raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Rate limit exceeded")
    finally:
        r.close()


def _maybe_notify_participants(
    *,
    assignment: Assignment,
    thread_id: int,
    author_id: int,
    message_body: str,
) -> None:
    # Throttle per recipient per thread: at most 1 notification per 2 minutes.
    recipients = [uid for uid in _assignment_participants(assignment) if uid != author_id]
    if not recipients:
        return
    r = _redis_client()
    try:
        for uid in recipients:
            tkey = f"throttle:chat:notify:{thread_id}:{uid}"
            # setnx-like behavior with TTL
            if r.set(tkey, "1", nx=True, ex=NOTIFY_THROTTLE_SECONDS):
                preview = (message_body or "").strip()
                if len(preview) > 120:
                    preview = preview[:117] + "..."
                link = f"/assignments/{assignment.id}/chat"
                notify_user.delay(
                    uid,
                    "Новое сообщение по назначению",
                    f"{preview}\n{link}",
                )
    finally:
        r.close()


@router.get("/thread", response_model=ChatThreadReadSchema)
def get_or_create_thread(
    db: DbSession,
    current_user: CurrentUser,
    assignment_id: int = Query(..., ge=1),
):
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")
    if not _can_access_assignment(assignment, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    thread = _get_or_create_thread(db, assignment_id)
    return thread


@router.get("/thread/{thread_id}/messages", response_model=list[ChatMessageRead])
def list_messages(
    thread_id: int,
    db: DbSession,
    current_user: CurrentUser,
    before_id: int | None = Query(None, ge=1),
    limit: int = Query(50, ge=1, le=200),
):
    thread = db.query(ChatThread).filter(ChatThread.id == thread_id).first()
    if not thread:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")
    assignment = db.query(Assignment).filter(Assignment.id == thread.assignment_id).first()
    if not assignment or not _can_access_assignment(assignment, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    q = db.query(ChatMessage).options(joinedload(ChatMessage.author)).filter(ChatMessage.thread_id == thread_id)
    if before_id is not None:
        q = q.filter(ChatMessage.id < before_id)
    # newest first for paging "up", client can reverse for display
    items = q.order_by(ChatMessage.id.desc()).limit(limit).all()
    return items


@router.get("/thread/{thread_id}/since", response_model=list[ChatMessageRead])
def list_messages_since(
    thread_id: int,
    db: DbSession,
    current_user: CurrentUser,
    after_id: int = Query(..., ge=0),
    limit: int = Query(200, ge=1, le=500),
):
    thread = db.query(ChatThread).filter(ChatThread.id == thread_id).first()
    if not thread:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")
    assignment = db.query(Assignment).filter(Assignment.id == thread.assignment_id).first()
    if not assignment or not _can_access_assignment(assignment, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    q = (
        db.query(ChatMessage)
        .options(joinedload(ChatMessage.author))
        .filter(ChatMessage.thread_id == thread_id, ChatMessage.id > after_id)
        .order_by(ChatMessage.id.asc())
        .limit(limit)
    )
    return q.all()


@router.post("/thread/{thread_id}/messages", response_model=ChatMessageRead, status_code=status.HTTP_201_CREATED)
def send_message(
    thread_id: int,
    data: ChatMessageCreate,
    db: DbSession,
    current_user: CurrentUser,
):
    thread = db.query(ChatThread).filter(ChatThread.id == thread_id).first()
    if not thread:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")
    assignment = db.query(Assignment).filter(Assignment.id == thread.assignment_id).first()
    if not assignment or not _can_access_assignment(assignment, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    body = (data.body or "").strip()
    if not body:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Message text is empty")
    if len(body) > 2000:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Message is too long")

    _rate_limit_or_429(user_id=current_user.id, thread_id=thread_id)

    msg = ChatMessage(thread_id=thread_id, author_id=current_user.id, body=body)
    db.add(msg)
    db.commit()
    db.refresh(msg)
    # ensure author is available in response payload
    msg = (
        db.query(ChatMessage)
        .options(joinedload(ChatMessage.author))
        .filter(ChatMessage.id == msg.id)
        .first()
    )

    # Optionally notify other participants with throttling.
    _maybe_notify_participants(
        assignment=assignment,
        thread_id=thread_id,
        author_id=current_user.id,
        message_body=body,
    )
    return msg


@router.post("/thread/{thread_id}/read", status_code=status.HTTP_200_OK)
def mark_thread_read(
    thread_id: int,
    data: ChatReadUpdate,
    db: DbSession,
    current_user: CurrentUser,
):
    thread = db.query(ChatThread).filter(ChatThread.id == thread_id).first()
    if not thread:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")
    assignment = db.query(Assignment).filter(Assignment.id == thread.assignment_id).first()
    if not assignment or not _can_access_assignment(assignment, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    last_id = data.last_read_message_id
    if last_id is None:
        last_id = db.query(func.max(ChatMessage.id)).filter(ChatMessage.thread_id == thread_id).scalar()

    rec = (
        db.query(ChatThreadRead)
        .with_for_update()
        .filter(ChatThreadRead.thread_id == thread_id, ChatThreadRead.user_id == current_user.id)
        .first()
    )
    now = datetime.now(timezone.utc)
    if not rec:
        rec = ChatThreadRead(thread_id=thread_id, user_id=current_user.id, last_read_message_id=last_id, updated_at=now)
        db.add(rec)
    else:
        # only move forward
        if last_id is not None and (rec.last_read_message_id is None or last_id > rec.last_read_message_id):
            rec.last_read_message_id = last_id
        rec.updated_at = now
    db.commit()
    return {"detail": "ok", "last_read_message_id": rec.last_read_message_id}


@router.get("/unread-count", response_model=ChatUnreadCountRead)
def unread_count_for_assignment(
    db: DbSession,
    current_user: CurrentUser,
    assignment_id: int = Query(..., ge=1),
):
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")
    if not _can_access_assignment(assignment, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    thread = db.query(ChatThread).filter(ChatThread.assignment_id == assignment_id).first()
    if not thread:
        return ChatUnreadCountRead(assignment_id=assignment_id, unread=0)

    read = (
        db.query(ChatThreadRead)
        .filter(ChatThreadRead.thread_id == thread.id, ChatThreadRead.user_id == current_user.id)
        .first()
    )
    last_read_id = read.last_read_message_id if read else None

    q = db.query(func.count(ChatMessage.id)).filter(ChatMessage.thread_id == thread.id, ChatMessage.author_id != current_user.id)
    if last_read_id is not None:
        q = q.filter(ChatMessage.id > last_read_id)
    unread = int(q.scalar() or 0)
    return ChatUnreadCountRead(assignment_id=assignment_id, unread=unread)


@router.get("/unread-counts", response_model=list[ChatUnreadCountRead])
def unread_counts_for_user(
    db: DbSession,
    current_user: CurrentUser,
):
    # For MVP: compute for assignments visible to user (simple, may be optimized later).
    aq = db.query(Assignment)
    if current_user.role == UserRole.admin:
        pass
    elif current_user.role == UserRole.student:
        aq = aq.filter(Assignment.student_id == current_user.id)
    elif current_user.role == UserRole.college_supervisor:
        aq = aq.filter(Assignment.college_supervisor_id == current_user.id)
    elif current_user.role == UserRole.company_supervisor:
        aq = aq.filter(Assignment.company_supervisor_id == current_user.id)
    else:
        return []
    assignments = aq.all()
    out: list[ChatUnreadCountRead] = []
    for a in assignments:
        out.append(unread_count_for_assignment(db=db, current_user=current_user, assignment_id=a.id))
    return out

