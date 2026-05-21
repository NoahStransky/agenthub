import { Injectable } from '@nestjs/common';
import { RuntimeProvider, RuntimeCreateRequest, RuntimeStatus } from './runtime.provider';

@Injectable()
export class InMemoryRuntimeProvider implements RuntimeProvider {
  private readonly queuedCreates: RuntimeCreateRequest[] = [];
  private readonly queuedStarts: Array<{ instanceId: string; tenantId: string }> = [];
  private readonly queuedStops: Array<{ instanceId: string; tenantId: string }> = [];
  private readonly queuedDeletes: Array<{ instanceId: string; tenantId: string }> = [];
  private readonly statuses = new Map<string, RuntimeStatus>();

  async enqueueCreateInstance(req: RuntimeCreateRequest): Promise<void> {
    this.queuedCreates.push(req);
    this.statuses.set(req.instanceId, {
      observedStatus: 'running',
      health: 'healthy',
      endpoint: `http://runtime.local/instances/${req.instanceId}`,
    });
  }

  async enqueueStartInstance(req: { instanceId: string; tenantId: string }): Promise<void> {
    this.queuedStarts.push(req);
    this.statuses.set(req.instanceId, {
      observedStatus: 'running',
      health: 'healthy',
      endpoint: `http://runtime.local/instances/${req.instanceId}`,
    });
  }

  async enqueueStopInstance(req: { instanceId: string; tenantId: string }): Promise<void> {
    this.queuedStops.push(req);
    this.statuses.set(req.instanceId, {
      observedStatus: 'stopped',
      health: 'unknown',
    });
  }

  async enqueueDeleteInstance(req: { instanceId: string; tenantId: string }): Promise<void> {
    this.queuedDeletes.push(req);
    this.statuses.set(req.instanceId, {
      observedStatus: 'deleted',
      health: 'unknown',
    });
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
