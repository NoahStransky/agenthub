"""Hermes 实例模型."""
import uuid
from datetime import datetime

from sqlalchemy import Column, String, DateTime, ForeignKey, JSON, Enum
from sqlalchemy.dialects.postgresql import UUID

from core.database import Base


class Instance(Base):
    __tablename__ = "instances"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    container_id = Column(String(100), nullable=True)  # Docker container ID
    container_name = Column(String(100), nullable=False)
    status = Column(String(20), default="pending")  # pending/running/stopped/error
    endpoint = Column(String(255), nullable=True)   # http://user1-hermes:8080
    metadata_ = Column("metadata", JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
