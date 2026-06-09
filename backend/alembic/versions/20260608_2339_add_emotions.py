"""add emotion and action to messages

Revision ID: 20260608_2339
Revises: (предыдущая миграция если есть)
Create Date: 2026-06-08 23:39

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260608_2339'
down_revision = None  # если есть предыдущие миграции — указать их ID
branch_labels = None
depends_on = None


def upgrade():
    # Добавляем поля emotion и action в таблицу messages
    op.add_column('messages', sa.Column('emotion', sa.String(length=32), nullable=True))
    op.add_column('messages', sa.Column('action', sa.String(length=200), nullable=True))


def downgrade():
    # Откат — удаляем добавленные поля
    op.drop_column('messages', 'action')
    op.drop_column('messages', 'emotion')
