"""Add chat threads/messages/reads

Revision ID: 003
Revises: 002
Create Date: 2026-04-26

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "chat_threads",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("assignment_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["assignment_id"], ["assignments.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("assignment_id"),
    )
    op.create_index("ix_chat_threads_assignment_id", "chat_threads", ["assignment_id"], unique=True)

    op.create_table(
        "chat_messages",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("thread_id", sa.Integer(), nullable=False),
        sa.Column("author_id", sa.Integer(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["thread_id"], ["chat_threads.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_chat_messages_thread_id", "chat_messages", ["thread_id"], unique=False)
    op.create_index("ix_chat_messages_author_id", "chat_messages", ["author_id"], unique=False)
    op.create_index("ix_chat_messages_thread_id_id", "chat_messages", ["thread_id", "id"], unique=False)

    op.create_table(
        "chat_thread_reads",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("thread_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("last_read_message_id", sa.Integer(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["last_read_message_id"], ["chat_messages.id"]),
        sa.ForeignKeyConstraint(["thread_id"], ["chat_threads.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("thread_id", "user_id", name="uq_chat_thread_reads_thread_user"),
    )
    op.create_index("ix_chat_thread_reads_thread_id", "chat_thread_reads", ["thread_id"], unique=False)
    op.create_index("ix_chat_thread_reads_user_id", "chat_thread_reads", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_chat_thread_reads_user_id", table_name="chat_thread_reads")
    op.drop_index("ix_chat_thread_reads_thread_id", table_name="chat_thread_reads")
    op.drop_table("chat_thread_reads")

    op.drop_index("ix_chat_messages_thread_id_id", table_name="chat_messages")
    op.drop_index("ix_chat_messages_author_id", table_name="chat_messages")
    op.drop_index("ix_chat_messages_thread_id", table_name="chat_messages")
    op.drop_table("chat_messages")

    op.drop_index("ix_chat_threads_assignment_id", table_name="chat_threads")
    op.drop_table("chat_threads")

