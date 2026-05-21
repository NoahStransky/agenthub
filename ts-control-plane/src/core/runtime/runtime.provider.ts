export type RuntimeType = 'docker' | 'kubernetes';
export type RuntimeClass = 'runc' | 'gvisor' | 'kata';

export interface RuntimeCreateRequest {
  instanceId: string;
  tenantId: string;
  tier: string;
  runtimeType: RuntimeType;
  runtimeClass: RuntimeClass;
}

export interface RuntimeCreateResult {
  runtimeResourceName?: string;
  containerId?: string;
  endpoint?: string;
}

export interface RuntimeStatus {
  observedStatus: string;
  health: string;
  endpoint?: string;
  failureReason?: string;
}

export interface RuntimeProvider {
  enqueueCreateInstance(req: RuntimeCreateRequest): Promise<void>;
  enqueueStartInstance(req: { instanceId: string; tenantId: string }): Promise<void>;
  enqueueStopInstance(req: { instanceId: string; tenantId: string }): Promise<void>;
  enqueueDeleteInstance(req: { instanceId: string; tenantId: string }): Promise<void>;
  getInstanceStatus(req: { instanceId?: string; runtimeResourceName?: string; containerId?: string }): Promise<RuntimeStatus>;
}

export const RUNTIME_PROVIDER = Symbol('RUNTIME_PROVIDER');
