"""Celery 异步任务配置."""
from celery import Celery
from core.config import settings

celery_app = Celery(
    "agenthub",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["workers.instance_tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)
