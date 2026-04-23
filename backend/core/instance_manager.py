"""Docker 实例管理 — 创建 / 启动 / 停止 / 销毁 Hermes 容器."""
import asyncio
from typing import Optional

import docker
from docker.errors import NotFound

from core.config import settings


class InstanceManager:
    """管理每个租户的 Hermes Docker 容器生命周期."""

    def __init__(self):
        self.client = docker.DockerClient(base_url=settings.DOCKER_HOST)

    def create_instance(self, tenant_id: str, tier: str = "free") -> str:
        """为新租户创建 Hermes 容器.

        Args:
            tenant_id: 租户唯一标识 (UUID)
            tier: 资源等级 free/pro/team/enterprise

        Returns:
            container_id
        """
        # TODO: Phase 1 — 实现容器创建逻辑
        # 1. 拉取/确认基础镜像
        # 2. 创建 Docker Volume (数据持久化)
        # 3. 根据 tier 设置 cgroup 配额
        # 4. 附加 Traefik labels 自动路由
        # 5. 启动容器并健康检查
        raise NotImplementedError("Phase 1 实现")

    def start_instance(self, tenant_id: str) -> bool:
        """启动已停止的容器."""
        raise NotImplementedError("Phase 1 实现")

    def stop_instance(self, tenant_id: str) -> bool:
        """停止容器 (保留数据)."""
        raise NotImplementedError("Phase 1 实现")

    def destroy_instance(self, tenant_id: str) -> bool:
        """销毁容器及关联数据卷 (不可逆)."""
        raise NotImplementedError("Phase 1 实现")

    def get_instance_status(self, tenant_id: str) -> dict:
        """查询容器运行状态."""
        raise NotImplementedError("Phase 1 实现")

    def list_instances(self) -> list[dict]:
        """列出所有租户容器 (管理员)."""
        raise NotImplementedError("Phase 1 实现")


# 全局单例
instance_manager = InstanceManager()
