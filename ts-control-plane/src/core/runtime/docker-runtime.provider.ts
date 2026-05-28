import { Injectable } from '@nestjs/common';
import {
  RuntimeCreateRequest,
  RuntimeCreateResult,
  RuntimeProvider,
  RuntimeStatus,
} from './runtime.provider';

interface DataPlaneStatusResponse {
  containerId?: string;
  status?: string;
  endpoint?: string;
  health?: string;
  failureReason?: string;
}

@Injectable()
export class DockerRuntimeProvider implements RuntimeProvider {
  private readonly baseUrl = (process.env.DATA_PLANE_HTTP_URL || 'http://127.0.0.1:8080').replace(/\/$/, '');

  async enqueueCreateInstance(req: RuntimeCreateRequest): Promise<RuntimeCreateResult> {
    const result = await this.request<DataPlaneStatusResponse>('/instances', {
      method: 'POST',
      body: JSON.stringify({
        instanceId: req.instanceId,
        tenantId: req.tenantId,
        tier: req.tier,
        runtimeClass: req.runtimeClass,
        containerName: req.containerName,
        workspace: req.workspace,
        gateway: req.gateway,
      }),
    });

    return {
      containerId: result.containerId,
      runtimeResourceName: req.containerName,
      endpoint: result.endpoint,
    };
  }

  async enqueueStartInstance(req: { instanceId: string; tenantId: string; containerId?: string }): Promise<RuntimeStatus> {
    this.assertContainerId(req.containerId);
    return this.mapStatus(await this.request<DataPlaneStatusResponse>(`/instances/${req.containerId}/start`, { method: 'POST' }));
  }

  async enqueueStopInstance(req: { instanceId: string; tenantId: string; containerId?: string }): Promise<RuntimeStatus> {
    this.assertContainerId(req.containerId);
    return this.mapStatus(await this.request<DataPlaneStatusResponse>(`/instances/${req.containerId}/stop`, { method: 'POST' }));
  }

  async enqueueDeleteInstance(req: { instanceId: string; tenantId: string; containerId?: string }): Promise<RuntimeStatus> {
    this.assertContainerId(req.containerId);
    await this.request(`/instances/${req.containerId}`, { method: 'DELETE' });
    return { observedStatus: 'deleted', health: 'unknown' };
  }

  async getInstanceStatus(req: { instanceId?: string; runtimeResourceName?: string; containerId?: string }): Promise<RuntimeStatus> {
    if (!req.containerId) {
      return { observedStatus: 'pending', health: 'unknown' };
    }

    return this.mapStatus(await this.request<DataPlaneStatusResponse>(`/instances/${req.containerId}/status`));
  }

  private async request<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set('Content-Type', 'application/json');
    const response = await fetch(`${this.baseUrl}${path}`, { ...init, headers });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(body || `Data-plane request failed with ${response.status}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  private mapStatus(status: DataPlaneStatusResponse): RuntimeStatus {
    const observedStatus = this.normalizeObservedStatus(status.status);
    return {
      observedStatus,
      health: status.health || (observedStatus === 'running' ? 'healthy' : 'unknown'),
      endpoint: status.endpoint,
      failureReason: status.failureReason,
    };
  }

  private normalizeObservedStatus(status?: string) {
    switch (status) {
      case 'running':
        return 'running';
      case 'created':
      case 'restarting':
        return 'pending';
      case 'exited':
      case 'paused':
        return 'stopped';
      case 'dead':
      case 'removing':
        return 'failed';
      case 'deleted':
        return 'deleted';
      default:
        return status || 'unknown';
    }
  }

  private assertContainerId(containerId?: string): asserts containerId is string {
    if (!containerId) {
      throw new Error('Runtime operation requires a containerId');
    }
  }
}
