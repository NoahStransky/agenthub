"""实例相关的异步任务."""
from workers.celery_app import celery_app
from core.instance_manager import instance_manager


@celery_app.task(bind=True, max_retries=3)
def create_instance_task(self, tenant_id: str, tier: str):
    """异步创建 Hermes 实例."""
    try:
        container_id = instance_manager.create_instance(tenant_id, tier)
        return {"status": "success", "container_id": container_id}
    except Exception as exc:
        raise self.retry(exc=exc, countdown=5)


@celery_app.task
def destroy_instance_task(tenant_id: str):
    """异步销毁 Hermes 实例."""
    instance_manager.destroy_instance(tenant_id)
    return {"status": "destroyed"}
