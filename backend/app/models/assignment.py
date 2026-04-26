import enum
from datetime import datetime
from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer
from sqlalchemy.orm import relationship

from app.core.database import Base


class AssignmentStatus(str, enum.Enum):
    draft = "draft"
    active = "active"
    completed = "completed"
    cancelled = "cancelled"


class Assignment(Base):
    __tablename__ = "assignments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    period_id = Column(Integer, ForeignKey("periods.id"), nullable=False)
    college_supervisor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    company_supervisor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(Enum(AssignmentStatus), default=AssignmentStatus.draft, nullable=False)
    college_grade = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    student = relationship("User", back_populates="assignments_as_student", foreign_keys=[student_id])
    college_supervisor = relationship(
        "User", back_populates="assignments_as_college_supervisor", foreign_keys=[college_supervisor_id]
    )
    company_supervisor = relationship(
        "User", back_populates="assignments_as_company_supervisor", foreign_keys=[company_supervisor_id]
    )
    company = relationship("Company", back_populates="assignments")
    period = relationship("Period", back_populates="assignments")
    tasks = relationship("Task", back_populates="assignment", order_by="Task.order")
    reports = relationship("Report", back_populates="assignment", order_by="Report.iteration")
