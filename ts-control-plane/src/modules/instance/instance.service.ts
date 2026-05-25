import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '@core/database/prisma.service';
import {
  RUNTIME_PROVIDER,
  RuntimeClass,
  RuntimeProvider,
  RuntimeType,
} from '@core/runtime/runtime.provider';
import { WorkspaceStorageProvider } from '@core/workspace/workspace-storage.provider';
import { CreateInstanceDto } from './dto/create-instance.dto';

@Injectable()
export class InstanceService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(RUNTIME_PROVIDER) private readonly runtime: RuntimeProvider,
    private readonly workspaceStorage: WorkspaceStorageProvider,
  ) {}

  async create(tenantId: string, dto: CreateInstanceDto = {}) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { tier: true },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant with id ${tenantId} not found`);
    }

    const tier = dto.tier ?? tenant.tier;
    const runtimeType: RuntimeType = dto.runtimeType ?? 'docker';
    const runtimeClass: RuntimeClass = dto.runtimeClass ?? 'runc';
    const containerName = `agenthub-${tenantId}-${Date.now()}`;
    const instanceId = randomUUID();
    const workspace = await this.workspaceStorage.provisionWorkspace({ tenantId, instanceId });
    const instance = await this.prisma.instance.create({
      data: {
        id: instanceId,
        tenantId,
        containerName,
        status: 'pending',
        runtimeType,
        runtimeClass,
        desiredStatus: 'running',
        observedStatus: 'pending',
        health: 'unknown',
        metadata: {
          name: dto.name,
          workspace: workspace.metadata,
        },
      } as any,
    });

    try {
      const runtimeResult = await this.runtime.enqueueCreateInstance({
        instanceId: instance.id,
        tenantId,
        tier,
        runtimeType,
        runtimeClass,
        containerName,
        workspace: workspace.runtime,
      });

      if (runtimeResult) {
        await this.prisma.instance.update({
          where: { id: instance.id },
          data: {
            containerId: runtimeResult.containerId,
            runtimeResourceName: runtimeResult.runtimeResourceName,
            endpoint: runtimeResult.endpoint,
          } as any,
        });
      }

      return this.syncRuntimeStatus(instance.id);
    } catch (error) {
      return this.markFailed(instance.id, error);
    }
  }

  async list(tenantId: string) {
    return this.prisma.instance.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getStatus(tenantId: string, instanceId: string) {
    const instance = await this.prisma.instance.findFirst({
      where: { id: instanceId, tenantId },
    });

    if (!instance) {
      throw new NotFoundException(`Instance with id ${instanceId} not found`);
    }

    const status = await this.runtime.getInstanceStatus({
      instanceId: instance.id,
      containerId: instance.containerId ?? undefined,
      runtimeResourceName: (instance as any).runtimeResourceName ?? undefined,
    });

    await this.prisma.instance.update({
      where: { id: instance.id },
      data: {
        observedStatus: status.observedStatus,
        health: status.health,
        endpoint: status.endpoint,
        failureReason: status.failureReason,
        status: status.observedStatus,
      } as any,
    });

    return status;
  }

  async start(tenantId: string, instanceId: string) {
    const instance = await this.findTenantInstance(tenantId, instanceId);

    await this.prisma.instance.update({
      where: { id: instance.id },
      data: {
        status: 'pending',
        desiredStatus: 'running',
        observedStatus: 'pending',
        health: 'unknown',
        failureReason: null,
      } as any,
    });

    try {
      const status = await this.runtime.enqueueStartInstance({
        tenantId,
        instanceId: instance.id,
        containerId: instance.containerId ?? undefined,
      });
      return status ? this.applyRuntimeStatus(instance.id, status) : this.syncRuntimeStatus(instance.id);
    } catch (error) {
      return this.markFailed(instance.id, error);
    }
  }

  async stop(tenantId: string, instanceId: string) {
    const instance = await this.findTenantInstance(tenantId, instanceId);

    await this.prisma.instance.update({
      where: { id: instance.id },
      data: {
        status: 'stopping',
        desiredStatus: 'stopped',
        observedStatus: 'pending',
      } as any,
    });

    try {
      const status = await this.runtime.enqueueStopInstance({
        tenantId,
        instanceId: instance.id,
        containerId: instance.containerId ?? undefined,
      });
      return status ? this.applyRuntimeStatus(instance.id, status) : this.syncRuntimeStatus(instance.id);
    } catch (error) {
      return this.markFailed(instance.id, error);
    }
  }

  async remove(tenantId: string, instanceId: string) {
    const instance = await this.findTenantInstance(tenantId, instanceId);

    await this.prisma.instance.update({
      where: { id: instance.id },
      data: {
        status: 'deleting',
        desiredStatus: 'deleted',
        observedStatus: 'pending',
      } as any,
    });

    try {
      const status = await this.runtime.enqueueDeleteInstance({
        tenantId,
        instanceId: instance.id,
        containerId: instance.containerId ?? undefined,
      });
      return status ? this.applyRuntimeStatus(instance.id, status) : this.syncRuntimeStatus(instance.id);
    } catch (error) {
      return this.markFailed(instance.id, error);
    }
  }

  private async findTenantInstance(tenantId: string, instanceId: string) {
    const instance = await this.prisma.instance.findFirst({
      where: { id: instanceId, tenantId },
    });

    if (!instance) {
      throw new NotFoundException(`Instance with id ${instanceId} not found`);
    }

    return instance;
  }

  private async syncRuntimeStatus(instanceId: string) {
    const instance = await this.prisma.instance.findFirst({
      where: { id: instanceId },
    });
    const status = await this.runtime.getInstanceStatus({
      instanceId,
      containerId: instance?.containerId ?? undefined,
      runtimeResourceName: (instance as any)?.runtimeResourceName ?? undefined,
    });

    return this.applyRuntimeStatus(instanceId, status);
  }

  private async applyRuntimeStatus(instanceId: string, status: { observedStatus: string; health: string; endpoint?: string; failureReason?: string }) {
    return this.prisma.instance.update({
      where: { id: instanceId },
      data: {
        observedStatus: status.observedStatus,
        health: status.health,
        endpoint: status.endpoint,
        failureReason: status.failureReason,
        status: status.observedStatus,
      } as any,
    });
  }

  private async markFailed(instanceId: string, error: unknown) {
    return this.prisma.instance.update({
      where: { id: instanceId },
      data: {
        status: 'failed',
        observedStatus: 'failed',
        health: 'unhealthy',
        failureReason: error instanceof Error ? error.message : 'Runtime operation failed',
      } as any,
    });
  }
}
