import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import {
  RUNTIME_PROVIDER,
  RuntimeClass,
  RuntimeProvider,
  RuntimeType,
} from '@core/runtime/runtime.provider';
import { CreateInstanceDto } from './dto/create-instance.dto';

@Injectable()
export class InstanceService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(RUNTIME_PROVIDER) private readonly runtime: RuntimeProvider,
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
    const instance = await this.prisma.instance.create({
      data: {
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
        },
      } as any,
    });

    await this.runtime.enqueueCreateInstance({
      instanceId: instance.id,
      tenantId,
      tier,
      runtimeType,
      runtimeClass,
    });

    return this.syncRuntimeStatus(instance.id);
  }

  async list(tenantId: string) {
    return this.prisma.instance.findMany({
      where: { tenantId },
    });
  }

  async getStatus(tenantId: string, instanceId: string) {
    const instance = await this.prisma.instance.findFirst({
      where: { id: instanceId, tenantId },
    });

    if (!instance) {
      throw new NotFoundException(`Instance with id ${instanceId} not found`);
    }

    return this.runtime.getInstanceStatus({
      instanceId: instance.id,
      containerId: instance.containerId ?? undefined,
      runtimeResourceName: (instance as any).runtimeResourceName ?? undefined,
    });
  }

  async start(tenantId: string, instanceId: string) {
    const instance = await this.findTenantInstance(tenantId, instanceId);

    await this.runtime.enqueueStartInstance({ tenantId, instanceId: instance.id });

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

    return this.syncRuntimeStatus(instance.id);
  }

  async stop(tenantId: string, instanceId: string) {
    const instance = await this.findTenantInstance(tenantId, instanceId);

    await this.runtime.enqueueStopInstance({ tenantId, instanceId: instance.id });

    await this.prisma.instance.update({
      where: { id: instance.id },
      data: {
        status: 'stopping',
        desiredStatus: 'stopped',
        observedStatus: 'pending',
      } as any,
    });

    return this.syncRuntimeStatus(instance.id);
  }

  async remove(tenantId: string, instanceId: string) {
    const instance = await this.findTenantInstance(tenantId, instanceId);

    await this.runtime.enqueueDeleteInstance({ tenantId, instanceId: instance.id });

    await this.prisma.instance.update({
      where: { id: instance.id },
      data: {
        status: 'deleting',
        desiredStatus: 'deleted',
        observedStatus: 'pending',
      } as any,
    });

    return this.syncRuntimeStatus(instance.id);
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
    const status = await this.runtime.getInstanceStatus({ instanceId });

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
}
