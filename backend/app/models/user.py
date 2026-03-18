import enum
from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, Enum, Integer, String
from sqlalchemy.orm import relationship

from app.core.database import Base


class UserRole(str, enum.Enum):
    admin = "admin"
    student = "student"
    college_supervisor = "college_supervisor"
    company_supervisor = "company_supervisor"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False, index=True)
    full_name = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    assignments_as_student = relationship("Assignment", back_populates="student", foreign_keys="Assignment.student_id")
    assignments_as_college_supervisor = relationship(
        "Assignment", back_populates="college_supervisor", foreign_keys="Assignment.college_supervisor_id"
    )
    assignments_as_company_supervisor = relationship(
        "Assignment", back_populates="company_supervisor", foreign_keys="Assignment.company_supervisor_id"
    )
    notifications = relationship("Notification", back_populates="user", order_by="Notification.created_at.desc()")
