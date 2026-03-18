from fastapi import APIRouter, Depends, HTTPException, status, Query

from app.core.deps import AdminUser, DbSession, CurrentUser
from app.models.period import Period
from app.schemas.period import PeriodCreate, PeriodRead, PeriodUpdate

router = APIRouter()


@router.get("", response_model=list[PeriodRead])
def list_periods(
    db: DbSession,
    current_user: CurrentUser,
    is_active: bool | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
):
    q = db.query(Period)
    if is_active is not None:
        q = q.filter(Period.is_active == is_active)
    return q.order_by(Period.start_date.desc()).offset(skip).limit(limit).all()


@router.get("/{period_id}", response_model=PeriodRead)
def get_period(period_id: int, db: DbSession, current_user: CurrentUser):
    period = db.query(Period).filter(Period.id == period_id).first()
    if not period:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Period not found")
    return period


@router.post("", response_model=PeriodRead, status_code=status.HTTP_201_CREATED)
def create_period(data: PeriodCreate, db: DbSession, current_user: AdminUser):
    if data.start_date > data.end_date:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="start_date must be before end_date")
    period = Period(
        name=data.name,
        start_date=data.start_date,
        end_date=data.end_date,
        is_active=data.is_active,
    )
    db.add(period)
    db.commit()
    db.refresh(period)
    return period


@router.patch("/{period_id}", response_model=PeriodRead)
def update_period(period_id: int, data: PeriodUpdate, db: DbSession, current_user: AdminUser):
    period = db.query(Period).filter(Period.id == period_id).first()
    if not period:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Period not found")
    if data.name is not None:
        period.name = data.name
    if data.start_date is not None:
        period.start_date = data.start_date
    if data.end_date is not None:
        period.end_date = data.end_date
    if data.is_active is not None:
        period.is_active = data.is_active
    if period.start_date > period.end_date:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="start_date must be before end_date")
    db.commit()
    db.refresh(period)
    return period


@router.delete("/{period_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_period(period_id: int, db: DbSession, current_user: AdminUser):
    period = db.query(Period).filter(Period.id == period_id).first()
    if not period:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Period not found")
    db.delete(period)
    db.commit()
