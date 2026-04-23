"""Task Pydantic Schemas."""
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel
from typing import List


class TaskCreate(BaseModel):
    project_id: UUID | None = None
    title: str
    description: str | None = None
    agents: List[str]


class TaskOut(BaseModel):
    id: UUID
    tenant_id: UUID
    title: str
    status: str
    agents: List[str]
    created_at: datetime

    class Config:
        from_attributes = True
