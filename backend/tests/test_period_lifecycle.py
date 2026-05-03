from datetime import date, timedelta

from app.models.period import Period
from app.services.period_lifecycle import deactivate_expired_periods


def test_deactivate_expired_periods_updates_only_past_end_dates(client):
    import app.core.database as database

    db = database.SessionLocal()
    try:
        today = date.today()
        past = Period(name="past", start_date=today - timedelta(days=10), end_date=today - timedelta(days=1), is_active=True)
        edge = Period(name="edge", start_date=today - timedelta(days=10), end_date=today, is_active=True)
        future = Period(name="future", start_date=today, end_date=today + timedelta(days=10), is_active=True)
        already_off = Period(
            name="off",
            start_date=today - timedelta(days=10),
            end_date=today - timedelta(days=1),
            is_active=False,
        )
        db.add_all([past, edge, future, already_off])
        db.commit()

        updated = deactivate_expired_periods(db)
        assert updated == 1

        db.refresh(past)
        db.refresh(edge)
        db.refresh(future)
        db.refresh(already_off)

        assert past.is_active is False
        assert edge.is_active is True
        assert future.is_active is True
        assert already_off.is_active is False
    finally:
        db.close()

