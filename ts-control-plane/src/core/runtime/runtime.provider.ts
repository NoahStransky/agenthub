export type RuntimeType = 'docker' | 'kubernetes';
export type RuntimeClass = 'runc' | 'gvisor' | 'kata';

export interface RuntimeCreateRequest {
  instanceId: string;
  tenantId: string;
  tier: string;
  runtimeType: RuntimeType;
  runtimeClass: RuntimeClass;
  containerName: string;
  workspace?: {
    provider: 'minio' | 's3';
    endpoint?: string;
    bucket: string;
    region: string;
    prefix: string;
    mountPath: string;
    accessKey?: string;
    secretKey?: string;
  };
  gateway?: {
    publicBaseUrl: string;
    proxyPath: string;
    webhookBasePath: string;
  };
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
  enqueueCreateInstance(req: RuntimeCreateRequest): Promise<RuntimeCreateResult | void>;
  enqueueStartInstance(req: { instanceId: string; tenantId: string; containerId?: string }): Promise<RuntimeStatus | void>;
  enqueueStopInstance(req: { instanceId: string; tenantId: string; containerId?: string }): Promise<RuntimeStatus | void>;
  enqueueDeleteInstance(req: { instanceId: string; tenantId: string; containerId?: string }): Promise<RuntimeStatus | void>;
  getInstanceStatus(req: { instanceId?: string; runtimeResourceName?: string; containerId?: string }): Promise<RuntimeStatus>;
}

export const RUNTIME_PROVIDER = Symbol('RUNTIME_PROVIDER');
