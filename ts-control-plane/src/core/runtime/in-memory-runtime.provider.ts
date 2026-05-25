import { Injectable } from '@nestjs/common';
import { RuntimeProvider, RuntimeCreateRequest, RuntimeStatus } from './runtime.provider';

@Injectable()
export class InMemoryRuntimeProvider implements RuntimeProvider {
  private readonly queuedCreates: RuntimeCreateRequest[] = [];
  private readonly queuedStarts: Array<{ instanceId: string; tenantId: string }> = [];
  private readonly queuedStops: Array<{ instanceId: string; tenantId: string }> = [];
  private readonly queuedDeletes: Array<{ instanceId: string; tenantId: string }> = [];
  private readonly statuses = new Map<string, RuntimeStatus>();

  async enqueueCreateInstance(req: RuntimeCreateRequest) {
    this.queuedCreates.push(req);
    const status = {
      observedStatus: 'running',
      health: 'healthy',
      endpoint: `http://runtime.local/instances/${req.instanceId}`,
    };
    this.statuses.set(req.instanceId, status);
    return {
      containerId: `memory-${req.instanceId}`,
      runtimeResourceName: req.containerName,
      endpoint: status.endpoint,
    };
  }

  async enqueueStartInstance(req: { instanceId: string; tenantId: string }) {
    this.queuedStarts.push(req);
    const status = {
      observedStatus: 'running',
      health: 'healthy',
      endpoint: `http://runtime.local/instances/${req.instanceId}`,
    };
    this.statuses.set(req.instanceId, status);
    return status;
  }

  async enqueueStopInstance(req: { instanceId: string; tenantId: string }) {
    this.queuedStops.push(req);
    const status = {
      observedStatus: 'stopped',
      health: 'unknown',
    };
    this.statuses.set(req.instanceId, status);
    return status;
  }

  async enqueueDeleteInstance(req: { instanceId: string; tenantId: string }) {
    this.queuedDeletes.push(req);
    const status = {
      observedStatus: 'deleted',
      health: 'unknown',
    };
    this.statuses.set(req.instanceId, status);
    return status;
  }

  async getInstanceStatus(req: { instanceId?: string }): Promise<RuntimeStatus> {
    if (req.instanceId && this.statuses.has(req.instanceId)) {
      return this.statuses.get(req.instanceId)!;
    }

    return {
      observedStatus: 'pending',
      health: 'unknown',
    };
  }

  getQueuedCreates(): RuntimeCreateRequest[] {
    return [...this.queuedCreates];
  }
}
