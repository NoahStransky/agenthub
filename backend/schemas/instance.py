"""Instance Pydantic Schemas."""
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel


class InstanceCreate(BaseModel):
    tier: str = "free"


class InstanceOut(BaseModel):
    id: UUID
    tenant_id: UUID
    container_id: str | None
    status: str
    endpoint: str | None
    created_at: datetime

    class Config:
        from_attributes = True
