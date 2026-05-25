import { DockerRuntimeProvider } from './docker-runtime.provider';

describe('DockerRuntimeProvider', () => {
  const originalFetch = global.fetch;
  const originalDataPlaneUrl = process.env.DATA_PLANE_HTTP_URL;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    process.env.DATA_PLANE_HTTP_URL = 'http://data-plane.local/';
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.DATA_PLANE_HTTP_URL = originalDataPlaneUrl;
    jest.clearAllMocks();
  });

  it('creates an instance through the data-plane HTTP API', async () => {
    fetchMock.mockResolvedValue(jsonResponse({
      containerId: 'container-1',
      endpoint: 'http://agenthub-tenant-1-1:8080',
      status: 'running',
      health: 'healthy',
    }));
    const provider = new DockerRuntimeProvider();

    const result = await provider.enqueueCreateInstance({
      instanceId: 'instance-1',
      tenantId: 'tenant-1',
      tier: 'pro',
      runtimeType: 'docker',
      runtimeClass: 'gvisor',
      containerName: 'agenthub-tenant-1-1',
      workspace: {
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

    expect(fetchMock).toHaveBeenCalledWith(
      'http://data-plane.local/instances',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          instanceId: 'instance-1',
          tenantId: 'tenant-1',
          tier: 'pro',
          runtimeClass: 'gvisor',
          containerName: 'agenthub-tenant-1-1',
          workspace: {
            provider: 'minio',
            endpoint: 'http://minio:9000',
            bucket: 'agenthub-workspaces',
            region: 'us-east-1',
            prefix: 'tenants/tenant-1/instances/instance-1/workspace/',
            mountPath: '/workspace',
            accessKey: 'agenthub',
            secretKey: 'agenthub-secret',
          },
        }),
      }),
    );
    expect(result).toEqual({
      containerId: 'container-1',
      runtimeResourceName: 'agenthub-tenant-1-1',
      endpoint: 'http://agenthub-tenant-1-1:8080',
    });
  });

  it.each([
    ['running', 'running', 'healthy'],
    ['created', 'pending', 'unknown'],
    ['restarting', 'pending', 'unknown'],
    ['exited', 'stopped', 'unknown'],
    ['paused', 'stopped', 'unknown'],
    ['dead', 'failed', 'unknown'],
    ['removing', 'failed', 'unknown'],
    ['deleted', 'deleted', 'unknown'],
    ['mystery', 'mystery', 'unknown'],
  ])('maps docker status %s to observed status %s', async (dockerStatus, observedStatus, health) => {
    fetchMock.mockResolvedValue(jsonResponse({ status: dockerStatus }));
    const provider = new DockerRuntimeProvider();

    await expect(provider.getInstanceStatus({ containerId: 'container-1' })).resolves.toEqual({
      observedStatus,
      health,
    });
  });

  it('returns pending when an instance does not have a container yet', async () => {
    const provider = new DockerRuntimeProvider();

    await expect(provider.getInstanceStatus({ instanceId: 'instance-1' })).resolves.toEqual({
      observedStatus: 'pending',
      health: 'unknown',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('starts, stops, and deletes by container id', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ status: 'running', health: 'healthy' }))
      .mockResolvedValueOnce(jsonResponse({ status: 'exited' }))
      .mockResolvedValueOnce(noContentResponse());
    const provider = new DockerRuntimeProvider();

    await expect(provider.enqueueStartInstance({ instanceId: 'instance-1', tenantId: 'tenant-1', containerId: 'container-1' }))
      .resolves.toEqual({ observedStatus: 'running', health: 'healthy' });
    await expect(provider.enqueueStopInstance({ instanceId: 'instance-1', tenantId: 'tenant-1', containerId: 'container-1' }))
      .resolves.toEqual({ observedStatus: 'stopped', health: 'unknown' });
    await expect(provider.enqueueDeleteInstance({ instanceId: 'instance-1', tenantId: 'tenant-1', containerId: 'container-1' }))
      .resolves.toEqual({ observedStatus: 'deleted', health: 'unknown' });

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'http://data-plane.local/instances/container-1/start', expect.objectContaining({ method: 'POST' }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'http://data-plane.local/instances/container-1/stop', expect.objectContaining({ method: 'POST' }));
    expect(fetchMock).toHaveBeenNthCalledWith(3, 'http://data-plane.local/instances/container-1', expect.objectContaining({ method: 'DELETE' }));
  });

  it('fails lifecycle operations without a container id', async () => {
    const provider = new DockerRuntimeProvider();

    await expect(provider.enqueueStartInstance({ instanceId: 'instance-1', tenantId: 'tenant-1' }))
      .rejects.toThrow('Runtime operation requires a containerId');
    await expect(provider.enqueueStopInstance({ instanceId: 'instance-1', tenantId: 'tenant-1' }))
      .rejects.toThrow('Runtime operation requires a containerId');
    await expect(provider.enqueueDeleteInstance({ instanceId: 'instance-1', tenantId: 'tenant-1' }))
      .rejects.toThrow('Runtime operation requires a containerId');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('surfaces data-plane errors with response body when available', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      text: jest.fn().mockResolvedValue('docker unavailable'),
    });
    const provider = new DockerRuntimeProvider();

    await expect(provider.getInstanceStatus({ containerId: 'container-1' })).rejects.toThrow('docker unavailable');
  });
});

function jsonResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: jest.fn().mockResolvedValue(body),
  };
}

function noContentResponse() {
  return {
    ok: true,
    status: 204,
  };
}
