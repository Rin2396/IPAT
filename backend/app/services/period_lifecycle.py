"""Helpers for period (practice window) lifecycle."""

from datetime import date

from sqlalchemy.orm import Session

from app.models.period import Period


def deactivate_expired_periods(db: Session) -> int:
    """Set is_active=False for periods whose end_date is before today. Returns number of rows updated."""
    today = date.today()
    count = (
        db.query(Period)
        .filter(Period.is_active.is_(True), Period.end_date < today)
        .update({Period.is_active: False}, synchronize_session=False)
    )
    if count:
        db.commit()
    return count
