from datetime import date, timedelta

from app.models.assignment import Assignment, AssignmentStatus
from app.models.company import Company
from app.models.period import Period
from app.models.user import User, UserRole


def _auth_header(user_id: int) -> dict[str, str]:
    return {"X-Test-User-Id": str(user_id)}


def _create_user(db, *, role: UserRole, email: str) -> User:
    u = User(
        email=email,
        hashed_password="test_hash",
        role=role,
        full_name=email.split("@", 1)[0],
        is_active=True,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def test_grade_only_college_supervisor_after_completed(client):
    import app.core.database as database

    db = database.SessionLocal()
    try:
        admin = _create_user(db, role=UserRole.admin, email="admin3@test.local")
        student = _create_user(db, role=UserRole.student, email="student3@test.local")
        cs = _create_user(db, role=UserRole.college_supervisor, email="cs3@test.local")
        other_cs = _create_user(db, role=UserRole.college_supervisor, email="cs4@test.local")

        company = Company(name="ACME2", inn=None, description=None, verified=True, blocked=False)
        period = Period(
            name="P",
            start_date=date.today() - timedelta(days=5),
            end_date=date.today() + timedelta(days=5),
            is_active=True,
        )
        db.add(company)
        db.add(period)
        db.commit()
        db.refresh(company)
        db.refresh(period)

        assignment = Assignment(
            student_id=student.id,
            company_id=company.id,
            period_id=period.id,
            college_supervisor_id=cs.id,
            company_supervisor_id=None,
            status=AssignmentStatus.active,
        )
        db.add(assignment)
        db.commit()
        db.refresh(assignment)
        admin_id = admin.id
        cs_id = cs.id
        other_cs_id = other_cs.id
    finally:
        db.close()

    # Not completed -> 400
    r = client.patch(
        f"/api/assignments/{assignment.id}/grade",
        json={"college_grade": 8},
        headers=_auth_header(cs_id),
    )
    assert r.status_code == 400

    # Other college supervisor -> 403
    r = client.patch(
        f"/api/assignments/{assignment.id}/grade",
        json={"college_grade": 8},
        headers=_auth_header(other_cs_id),
    )
    assert r.status_code == 403

    # Admin cannot set grade -> 403
    r = client.patch(
        f"/api/assignments/{assignment.id}/grade",
        json={"college_grade": 8},
        headers=_auth_header(admin_id),
    )
    assert r.status_code == 403

    # Mark assignment completed as admin (admin-only update endpoint)
    r = client.patch(
        f"/api/assignments/{assignment.id}",
        json={"status": "completed"},
        headers=_auth_header(admin_id),
    )
    assert r.status_code == 200
    assert r.json()["status"] == "completed"

    # Now grade allowed for the assigned college supervisor
    r = client.patch(
        f"/api/assignments/{assignment.id}/grade",
        json={"college_grade": 9},
        headers=_auth_header(cs_id),
    )
    assert r.status_code == 200
    assert r.json()["college_grade"] == 9

