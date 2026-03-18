from fastapi import APIRouter, Depends, HTTPException, status, Query

from app.core.deps import DbSession, CurrentUser
from app.models.notification import Notification
from app.schemas.notification import NotificationRead, NotificationMarkRead

router = APIRouter()


@router.get("", response_model=list[NotificationRead])
def list_notifications(
    db: DbSession,
    current_user: CurrentUser,
    unread_only: bool = Query(False),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    q = db.query(Notification).filter(Notification.user_id == current_user.id)
    if unread_only:
        q = q.filter(Notification.read == False)
    return q.order_by(Notification.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/unread-count")
def unread_count(db: DbSession, current_user: CurrentUser):
    count = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.read == False,
    ).count()
    return {"count": count}


@router.patch("/{notification_id}", response_model=NotificationRead)
def mark_notification_read(
    notification_id: int,
    data: NotificationMarkRead,
    db: DbSession,
    current_user: CurrentUser,
):
    notification = db.query(Notification).filter(Notification.id == notification_id).first()
    if not notification:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    if notification.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    notification.read = data.read
    db.commit()
    db.refresh(notification)
    return notification


@router.post("/read-all", status_code=status.HTTP_200_OK)
def mark_all_read(db: DbSession, current_user: CurrentUser):
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.read == False,
    ).update({Notification.read: True})
    db.commit()
    return {"detail": "ok"}
