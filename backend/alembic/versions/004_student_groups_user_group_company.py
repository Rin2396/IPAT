"""Student groups and user group/company links

Revision ID: 004
Revises: 003
Create Date: 2026-05-11

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "student_groups",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )

    op.add_column("users", sa.Column("student_group_id", sa.Integer(), nullable=True))
    op.add_column("users", sa.Column("company_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_users_student_group_id_student_groups",
        "users",
        "student_groups",
        ["student_group_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_users_company_id_companies",
        "users",
        "companies",
        ["company_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_users_company_id_companies", "users", type_="foreignkey")
    op.drop_constraint("fk_users_student_group_id_student_groups", "users", type_="foreignkey")
    op.drop_column("users", "company_id")
    op.drop_column("users", "student_group_id")
    op.drop_table("student_groups")
