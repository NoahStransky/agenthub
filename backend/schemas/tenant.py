"""Tenant Pydantic Schemas."""
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, EmailStr


class TenantCreate(BaseModel):
    email: EmailStr
    password: str
    name: str | None = None


class TenantOut(BaseModel):
    id: UUID
    email: str
    name: str | None
    tier: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True
