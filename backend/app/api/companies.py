from fastapi import APIRouter, Depends, HTTPException, status, Query

from app.core.deps import AdminUser, DbSession, CurrentUser
from app.models.company import Company
from app.models.user import UserRole
from app.schemas.company import CompanyCreate, CompanyRead, CompanyUpdate

router = APIRouter()


def _can_manage_companies(user) -> bool:
    return user.role == UserRole.admin


@router.get("", response_model=list[CompanyRead])
def list_companies(
    db: DbSession,
    current_user: CurrentUser,
    verified: bool | None = Query(None),
    blocked: bool | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
):
    q = db.query(Company)
    if verified is not None:
        q = q.filter(Company.verified == verified)
    if blocked is not None:
        q = q.filter(Company.blocked == blocked)
    return q.offset(skip).limit(limit).all()


@router.get("/{company_id}", response_model=CompanyRead)
def get_company(company_id: int, db: DbSession, current_user: CurrentUser):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")
    return company


@router.post("", response_model=CompanyRead, status_code=status.HTTP_201_CREATED)
def create_company(data: CompanyCreate, db: DbSession, current_user: AdminUser):
    company = Company(
        name=data.name,
        inn=data.inn,
        description=data.description,
        verified=False,
        blocked=False,
    )
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


@router.patch("/{company_id}", response_model=CompanyRead)
def update_company(company_id: int, data: CompanyUpdate, db: DbSession, current_user: AdminUser):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")
    if data.name is not None:
        company.name = data.name
    if data.inn is not None:
        company.inn = data.inn
    if data.description is not None:
        company.description = data.description
    db.commit()
    db.refresh(company)
    return company


@router.post("/{company_id}/verify", response_model=CompanyRead)
def verify_company(company_id: int, db: DbSession, current_user: AdminUser):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")
    company.verified = True
    company.blocked = False
    db.commit()
    db.refresh(company)
    return company


@router.post("/{company_id}/block", response_model=CompanyRead)
def block_company(company_id: int, db: DbSession, current_user: AdminUser):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")
    company.blocked = True
    db.commit()
    db.refresh(company)
    return company


@router.delete("/{company_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_company(company_id: int, db: DbSession, current_user: AdminUser):
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found")
    db.delete(company)
    db.commit()
