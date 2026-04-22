import io
import uuid
from pathlib import Path
from datetime import timedelta

from fastapi import APIRouter, Depends, File, HTTPException, status, Query, UploadFile
from fastapi.responses import StreamingResponse

from app.core.config import settings
from app.core.deps import DbSession, CurrentUser
from app.models.assignment import Assignment
from app.models.report import Report, ReportStatus
from app.models.user import UserRole
from app.schemas.report import ReportRead, ReportUpdate
from app.services.minio_client import get_minio_client, ensure_bucket
from app.tasks.notifications import notify_user

router = APIRouter()

REPORT_STATUS_TRANSITIONS = {
    ReportStatus.draft: (ReportStatus.submitted,),
    ReportStatus.submitted: (ReportStatus.under_review,),
    ReportStatus.under_review: (ReportStatus.approved, ReportStatus.revision_requested),
    ReportStatus.revision_requested: (ReportStatus.submitted, ReportStatus.draft),
    ReportStatus.approved: (),
}


def _can_access_assignment(assignment: Assignment, user) -> bool:
    if user.role == UserRole.admin:
        return True
    if assignment.student_id == user.id:
        return True
    if assignment.college_supervisor_id == user.id or assignment.company_supervisor_id == user.id:
        return True
    return False


def _can_review_report(user) -> bool:
    return user.role in (UserRole.admin, UserRole.college_supervisor, UserRole.company_supervisor)


@router.get("", response_model=list[ReportRead])
def list_reports(
    db: DbSession,
    current_user: CurrentUser,
    assignment_id: int = Query(...),
):
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")
    if not _can_access_assignment(assignment, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    reports = db.query(Report).filter(Report.assignment_id == assignment_id).order_by(Report.iteration).all()
    return reports


@router.get("/{report_id}", response_model=ReportRead)
def get_report(report_id: int, db: DbSession, current_user: CurrentUser):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    assignment = db.query(Assignment).filter(Assignment.id == report.assignment_id).first()
    if not assignment or not _can_access_assignment(assignment, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    return report


@router.get("/{report_id}/download")
def download_report_file(report_id: int, db: DbSession, current_user: CurrentUser):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    assignment = db.query(Assignment).filter(Assignment.id == report.assignment_id).first()
    if not assignment or not _can_access_assignment(assignment, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    client = get_minio_client()
    ensure_bucket(client, settings.MINIO_BUCKET)
    obj = client.get_object(settings.MINIO_BUCKET, report.file_key)
    filename = Path(report.file_key).name or f"report-{report.id}"
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return StreamingResponse(obj.stream(32 * 1024), media_type="application/octet-stream", headers=headers)


@router.delete("/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_report(report_id: int, db: DbSession, current_user: CurrentUser):
    report = db.query(Report).with_for_update().filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    assignment = db.query(Assignment).filter(Assignment.id == report.assignment_id).first()
    if not assignment or not _can_access_assignment(assignment, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    if report.status != ReportStatus.draft:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Can only delete draft reports")
    if assignment.student_id != current_user.id and current_user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only student or admin can delete")
    client = get_minio_client()
    ensure_bucket(client, settings.MINIO_BUCKET)
    try:
        client.remove_object(settings.MINIO_BUCKET, report.file_key)
    except Exception:
        # If object is already missing, still allow DB delete to unblock user.
        pass
    db.delete(report)
    db.commit()


@router.post("", response_model=ReportRead, status_code=status.HTTP_201_CREATED)
def upload_report(
    db: DbSession,
    current_user: CurrentUser,
    file: UploadFile = File(...),
    assignment_id: int = Query(...),
    iteration: int = Query(1, ge=1),
):
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")
    if not _can_access_assignment(assignment, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    if assignment.student_id != current_user.id and current_user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only student or admin can upload")
    filename = file.filename or "report"
    if not filename or filename == "blob":
        filename = "report.pdf"
    object_name = f"{assignment_id}/{uuid.uuid4().hex}/{filename}"
    client = get_minio_client()
    ensure_bucket(client, settings.MINIO_BUCKET)
    content = file.file.read()
    client.put_object(
        settings.MINIO_BUCKET,
        object_name,
        data=io.BytesIO(content),
        length=len(content),
        content_type=file.content_type or "application/octet-stream",
    )
    report = Report(
        assignment_id=assignment_id,
        iteration=iteration,
        file_key=object_name,
        status=ReportStatus.draft,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


@router.patch("/{report_id}", response_model=ReportRead)
def update_report_status(report_id: int, data: ReportUpdate, db: DbSession, current_user: CurrentUser):
    report = db.query(Report).with_for_update().filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    assignment = db.query(Assignment).filter(Assignment.id == report.assignment_id).first()
    if not assignment or not _can_access_assignment(assignment, current_user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    if data.status is not None:
        allowed = REPORT_STATUS_TRANSITIONS.get(report.status, ())
        if data.status not in allowed and data.status != report.status:
            if data.status in (ReportStatus.under_review, ReportStatus.approved, ReportStatus.revision_requested):
                if not _can_review_report(current_user):
                    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only supervisor can review")
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot transition from {report.status} to {data.status}",
                )
        report.status = data.status
        if assignment.student_id and data.status.value in ("approved", "revision_requested"):
            notify_user.delay(
                assignment.student_id,
                "Статус отчёта изменён",
                f"Отчёт (итерация {report.iteration}) переведён в статус «{data.status.value}».",
            )
    db.commit()
    db.refresh(report)
    return report
