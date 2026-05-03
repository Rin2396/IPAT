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


def _create_company(db) -> Company:
    c = Company(name="ACME", inn=None, description=None, verified=True, blocked=False)
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


def _create_period(db, *, start: date, end: date, is_active: bool = True) -> Period:
    p = Period(name="Spring", start_date=start, end_date=end, is_active=is_active)
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


def _create_assignment(
    db,
    *,
    student_id: int,
    company_id: int,
    period_id: int,
    college_supervisor_id: int | None = None,
    company_supervisor_id: int | None = None,
    status: AssignmentStatus = AssignmentStatus.draft,
) -> Assignment:
    a = Assignment(
        student_id=student_id,
        company_id=company_id,
        period_id=period_id,
        college_supervisor_id=college_supervisor_id,
        company_supervisor_id=company_supervisor_id,
        status=status,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return a


def test_assignments_create_update_delete_admin_only(client):
    import app.core.database as database

    db = database.SessionLocal()
    try:
        admin = _create_user(db, role=UserRole.admin, email="admin@test.local")
        student = _create_user(db, role=UserRole.student, email="student@test.local")
        company = _create_company(db)
        period = _create_period(db, start=date.today(), end=date.today() + timedelta(days=10))
        admin_id = admin.id
        student_id = student.id
        company_id = company.id
        period_id = period.id
    finally:
        db.close()

    # POST /assignments
    payload = {"student_id": student_id, "company_id": company_id, "period_id": period_id}
    r = client.post("/api/assignments", json=payload, headers=_auth_header(student_id))
    assert r.status_code == 403
    r = client.post("/api/assignments", json=payload, headers=_auth_header(admin_id))
    assert r.status_code == 201
    assignment_id = r.json()["id"]

    # PATCH /assignments/{id}
    r = client.patch(
        f"/api/assignments/{assignment_id}",
        json={"status": "active"},
        headers=_auth_header(student_id),
    )
    assert r.status_code == 403
    r = client.patch(
        f"/api/assignments/{assignment_id}",
        json={"status": "active"},
        headers=_auth_header(admin_id),
    )
    assert r.status_code == 200
    assert r.json()["status"] == "active"

    # DELETE /assignments/{id} (only draft is allowed)
    r = client.delete(f"/api/assignments/{assignment_id}", headers=_auth_header(admin_id))
    assert r.status_code == 400


def test_assignments_list_scoped_by_role(client):
    import app.core.database as database

    db = database.SessionLocal()
    try:
        admin = _create_user(db, role=UserRole.admin, email="admin2@test.local")
        s1 = _create_user(db, role=UserRole.student, email="s1@test.local")
        s2 = _create_user(db, role=UserRole.student, email="s2@test.local")
        cs1 = _create_user(db, role=UserRole.college_supervisor, email="cs1@test.local")
        cs2 = _create_user(db, role=UserRole.college_supervisor, email="cs2@test.local")
        co1 = _create_user(db, role=UserRole.company_supervisor, email="co1@test.local")
        admin_id = admin.id
        s1_id = s1.id
        cs1_id = cs1.id
        co1_id = co1.id

        company = _create_company(db)
        period = _create_period(db, start=date.today(), end=date.today() + timedelta(days=10))

        a1 = _create_assignment(
            db,
            student_id=s1.id,
            company_id=company.id,
            period_id=period.id,
            college_supervisor_id=cs1.id,
            company_supervisor_id=co1.id,
            status=AssignmentStatus.active,
        )
        a2 = _create_assignment(
            db,
            student_id=s2.id,
            company_id=company.id,
            period_id=period.id,
            college_supervisor_id=cs2.id,
            company_supervisor_id=None,
            status=AssignmentStatus.active,
        )
    finally:
        db.close()

    # Admin sees all
    r = client.get("/api/assignments", headers=_auth_header(admin_id))
    assert r.status_code == 200
    ids = {x["id"] for x in r.json()}
    assert {a1.id, a2.id}.issubset(ids)

    # Student sees only own
    r = client.get("/api/assignments", headers=_auth_header(s1_id))
    assert r.status_code == 200
    ids = {x["id"] for x in r.json()}
    assert ids == {a1.id}

    # College supervisor sees only where assigned
    r = client.get("/api/assignments", headers=_auth_header(cs1_id))
    assert r.status_code == 200
    ids = {x["id"] for x in r.json()}
    assert ids == {a1.id}

    # Company supervisor sees only where assigned
    r = client.get("/api/assignments", headers=_auth_header(co1_id))
    assert r.status_code == 200
    ids = {x["id"] for x in r.json()}
    assert ids == {a1.id}

