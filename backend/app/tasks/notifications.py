from app.celery_app import celery_app
from app.core.database import SessionLocal
from app.models.notification import Notification


@celery_app.task
def notify_user(user_id: int, title: str, body: str | None = None) -> None:
    db = SessionLocal()
    try:
        notification = Notification(user_id=user_id, title=title, body=body or "", read=False)
        db.add(notification)
        db.commit()
    finally:
        db.close()


@celery_app.task
def send_periodic_reminder() -> None:
    db = SessionLocal()
    try:
        from datetime import datetime, timedelta, timezone
        from app.models.assignment import Assignment, AssignmentStatus
        from app.models.period import Period
        now = datetime.now(timezone.utc).date()
        periods = db.query(Period).filter(
            Period.is_active == True,
            Period.end_date >= now,
            Period.end_date <= now + timedelta(days=7),
        ).all()
        for period in periods:
            assignments = db.query(Assignment).filter(
                Assignment.period_id == period.id,
                Assignment.status == AssignmentStatus.active,
            ).all()
            for a in assignments:
                notify_user.delay(
                    a.student_id,
                    "Напоминание о практике",
                    f"Период практики «{period.name}» заканчивается {period.end_date}. Убедитесь, что отчёты сданы.",
                )
    finally:
        db.close()
