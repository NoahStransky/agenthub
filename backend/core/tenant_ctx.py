"""多租户上下文 — 在请求生命周期中传递 tenant_id."""
from contextvars import ContextVar
from typing import Optional
from uuid import UUID

tenant_ctx: ContextVar[Optional[UUID]] = ContextVar("tenant_ctx", default=None)


def set_tenant(tenant_id: UUID):
    tenant_ctx.set(tenant_id)


def get_tenant() -> Optional[UUID]:
    return tenant_ctx.get()
