import { WorkspaceStorageProvider } from './workspace-storage.provider';

describe('WorkspaceStorageProvider', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      WORKSPACE_STORAGE_PROVIDER: 'minio',
      WORKSPACE_S3_ENDPOINT: 'http://minio:9000',
      WORKSPACE_S3_BUCKET: 'agenthub-workspaces',
      WORKSPACE_S3_REGION: 'us-east-1',
      WORKSPACE_S3_ACCESS_KEY: 'agenthub',
      WORKSPACE_S3_SECRET_KEY: 'agenthub-secret',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('provisions deterministic tenant and instance scoped workspace metadata', async () => {
    const provider = new WorkspaceStorageProvider();

    await expect(provider.provisionWorkspace({ tenantId: 'tenant-1', instanceId: 'instance-1' })).resolves.toEqual({
      metadata: {
        provider: 'minio',
        endpoint: 'http://minio:9000',
        bucket: 'agenthub-workspaces',
        region: 'us-east-1',
        prefix: 'tenants/tenant-1/instances/instance-1/workspace/',
        mountPath: '/workspace',
      },
      runtime: {
        provider: 'minio',
        endpoint: 'http://minio:9000',
        bucket: 'agenthub-workspaces',
        region: 'us-east-1',
        prefix: 'tenants/tenant-1/instances/instance-1/workspace/',
        mountPath: '/workspace',
        accessKey: 'agenthub',
        secretKey: 'agenthub-secret',
      },
    });
  });

  it('omits credentials from persisted metadata', async () => {
    const provider = new WorkspaceStorageProvider();
    const workspace = await provider.provisionWorkspace({ tenantId: 'tenant-1', instanceId: 'instance-1' });

    expect(workspace.metadata).not.toHaveProperty('accessKey');
    expect(workspace.metadata).not.toHaveProperty('secretKey');
  });
});
