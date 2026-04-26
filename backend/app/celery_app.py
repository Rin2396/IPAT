from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "ipat",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.REDIS_URL,
    include=["app.tasks.notifications"],
)
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
)
celery_app.conf.beat_schedule = {
    "periodic-notification-check": {
        "task": "app.tasks.notifications.send_periodic_reminder",
        "schedule": 3600.0,
    },
    "deactivate-expired-periods": {
        "task": "app.tasks.notifications.deactivate_expired_periods_task",
        "schedule": 3600.0,
    },
}
