import { Injectable } from '@nestjs/common';

export interface WorkspaceRuntimeSpec {
  provider: 'minio' | 's3';
  endpoint?: string;
  bucket: string;
  region: string;
  prefix: string;
  mountPath: string;
  accessKey?: string;
  secretKey?: string;
}

export interface WorkspaceMetadata {
  provider: WorkspaceRuntimeSpec['provider'];
  endpoint?: string;
  bucket: string;
  region: string;
  prefix: string;
  mountPath: string;
}

@Injectable()
export class WorkspaceStorageProvider {
  private readonly provider = (process.env.WORKSPACE_STORAGE_PROVIDER === 's3' ? 's3' : 'minio') as 'minio' | 's3';
  private readonly bucket = process.env.WORKSPACE_S3_BUCKET || 'agenthub-workspaces';
  private readonly region = process.env.WORKSPACE_S3_REGION || 'us-east-1';
  private readonly endpoint = process.env.WORKSPACE_S3_ENDPOINT;
  private readonly accessKey = process.env.WORKSPACE_S3_ACCESS_KEY;
  private readonly secretKey = process.env.WORKSPACE_S3_SECRET_KEY;
  private readonly mountPath = process.env.WORKSPACE_MOUNT_PATH || '/workspace';

  async provisionWorkspace(input: { tenantId: string; instanceId: string }): Promise<{
    runtime: WorkspaceRuntimeSpec;
    metadata: WorkspaceMetadata;
  }> {
    const prefix = this.buildPrefix(input.tenantId, input.instanceId);
    const metadata: WorkspaceMetadata = {
      provider: this.provider,
      endpoint: this.endpoint,
      bucket: this.bucket,
      region: this.region,
      prefix,
      mountPath: this.mountPath,
    };

    return {
      metadata,
      runtime: {
        ...metadata,
        accessKey: this.accessKey,
        secretKey: this.secretKey,
      },
    };
  }

  private buildPrefix(tenantId: string, instanceId: string) {
    return `tenants/${tenantId}/instances/${instanceId}/workspace/`;
  }
}
