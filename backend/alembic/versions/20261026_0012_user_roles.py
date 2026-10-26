"""Expand the persisted user role constraint without changing existing users.

Revision ID: 20261026_0012
Revises: 20261022_0011
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261026_0012"
down_revision: str | None = "20261022_0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ALL_ROLES = (
    "CUSTOMER", "MANAGER", "SUPPORT", "CONTENT_MANAGER", "WAREHOUSE_MANAGER",
    "ORDER_MANAGER", "SUPER_ADMIN", "ADMIN",
)
ORIGINAL_ROLES = ("CUSTOMER", "MANAGER", "ADMIN")


def _replace_roles(roles: tuple[str, ...], old_length: int, new_length: int) -> None:
    allowed = ", ".join(f"'{role}'" for role in roles)
    with op.batch_alter_table("users") as batch:
        batch.drop_constraint("user_role", type_="check")
        batch.alter_column(
            "role", existing_type=sa.String(old_length), type_=sa.String(new_length),
            existing_nullable=False,
        )
        batch.create_check_constraint("user_role", f"role IN ({allowed})")


def upgrade() -> None:
    _replace_roles(ALL_ROLES, 8, 32)


def downgrade() -> None:
    users = sa.table("users", sa.column("role", sa.String()))
    extended_role = op.get_bind().execute(
        sa.select(users.c.role).where(users.c.role.not_in(ORIGINAL_ROLES)).limit(1)
    ).first()
    if extended_role:
        raise RuntimeError("Cannot downgrade while users have extended roles; no users were modified")
    _replace_roles(ORIGINAL_ROLES, 32, 8)
