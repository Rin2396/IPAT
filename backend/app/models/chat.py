from __future__ import annotations

from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Text, UniqueConstraint, Index
from sqlalchemy.orm import relationship

from app.core.database import Base


class ChatThread(Base):
    __tablename__ = "chat_threads"

    id = Column(Integer, primary_key=True, autoincrement=True)
    assignment_id = Column(Integer, ForeignKey("assignments.id"), nullable=False, unique=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    assignment = relationship("Assignment")
    messages = relationship("ChatMessage", back_populates="thread", order_by="ChatMessage.id")
    reads = relationship("ChatThreadRead", back_populates="thread")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    thread_id = Column(Integer, ForeignKey("chat_threads.id"), nullable=False, index=True)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    thread = relationship("ChatThread", back_populates="messages")
    author = relationship("User")

    __table_args__ = (
        Index("ix_chat_messages_thread_id_id", "thread_id", "id"),
    )


class ChatThreadRead(Base):
    __tablename__ = "chat_thread_reads"

    id = Column(Integer, primary_key=True, autoincrement=True)
    thread_id = Column(Integer, ForeignKey("chat_threads.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    last_read_message_id = Column(Integer, ForeignKey("chat_messages.id"), nullable=True)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    thread = relationship("ChatThread", back_populates="reads")
    user = relationship("User")
    last_read_message = relationship("ChatMessage")

    __table_args__ = (
        UniqueConstraint("thread_id", "user_id", name="uq_chat_thread_reads_thread_user"),
    )

