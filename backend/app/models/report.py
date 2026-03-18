import enum
from datetime import datetime
from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.core.database import Base


class ReportStatus(str, enum.Enum):
    draft = "draft"
    submitted = "submitted"
    under_review = "under_review"
    approved = "approved"
    revision_requested = "revision_requested"


class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    assignment_id = Column(Integer, ForeignKey("assignments.id"), nullable=False)
    iteration = Column(Integer, default=1, nullable=False)
    file_key = Column(String(512), nullable=False)
    status = Column(Enum(ReportStatus), default=ReportStatus.draft, nullable=False)
    uploaded_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    assignment = relationship("Assignment", back_populates="reports")
