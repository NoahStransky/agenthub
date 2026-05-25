import { Test, TestingModule } from '@nestjs/testing';
import { InstanceService } from './instance.service';
import { PrismaService } from '@core/database/prisma.service';
import { RUNTIME_PROVIDER, RuntimeProvider } from '@core/runtime/runtime.provider';
import { WorkspaceStorageProvider } from '@core/workspace/workspace-storage.provider';

describe('InstanceService', () => {
  let service: InstanceService;
  let prisma: any;
  let runtime: RuntimeProvider;

  const mockPrismaService = {
    tenant: {
      findUnique: jest.fn(),
    },
    instance: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockRuntimeProvider: RuntimeProvider = {
    enqueueCreateInstance: jest.fn(),
    enqueueStartInstance: jest.fn(),
    enqueueStopInstance: jest.fn(),
    enqueueDeleteInstance: jest.fn(),
    getInstanceStatus: jest.fn(),
  };
  const mockWorkspaceStorage = {
    provisionWorkspace: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InstanceService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RUNTIME_PROVIDER, useValue: mockRuntimeProvider },
        { provide: WorkspaceStorageProvider, useValue: mockWorkspaceStorage },
      ],
    }).compile();

    service = module.get<InstanceService>(InstanceService);
    prisma = module.get<PrismaService>(PrismaService);
    runtime = module.get<RuntimeProvider>(RUNTIME_PROVIDER);

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a pending instance from tenant context and enqueue runtime creation', async () => {
      const tenantId = 'tenant-1';
      const dto = { name: 'Default Hermes', runtimeClass: 'gvisor' as const };
      const createdInstance = {
        id: 'instance-1',
        tenantId,
        containerName: 'agenthub-tenant-1-123456',
        status: 'pending',
        desiredStatus: 'running',
        observedStatus: 'pending',
        health: 'unknown',
        runtimeType: 'docker',
        runtimeClass: 'gvisor',
        endpoint: null,
        containerId: null,
      };

      mockPrismaService.tenant.findUnique.mockResolvedValue({ tier: 'pro' });
      mockWorkspaceStorage.provisionWorkspace.mockResolvedValue({
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
      mockPrismaService.instance.create.mockResolvedValue(createdInstance);
      (mockRuntimeProvider.enqueueCreateInstance as jest.Mock).mockResolvedValue(undefined);
      (mockRuntimeProvider.getInstanceStatus as jest.Mock).mockResolvedValue({
        observedStatus: 'running',
        health: 'healthy',
        endpoint: 'http://runtime.local/instances/instance-1',
      });
      mockPrismaService.instance.update.mockResolvedValue({
        ...createdInstance,
        observedStatus: 'running',
        health: 'healthy',
      });

      const result = await service.create(tenantId, dto);

      expect(prisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { id: tenantId },
        select: { tier: true },
      });

      expect(prisma.instance.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: expect.any(String),
          tenantId,
          containerName: expect.any(String),
          status: 'pending',
          runtimeType: 'docker',
          runtimeClass: 'gvisor',
          desiredStatus: 'running',
          observedStatus: 'pending',
          health: 'unknown',
          metadata: expect.objectContaining({
            workspace: expect.objectContaining({
              bucket: 'agenthub-workspaces',
              prefix: 'tenants/tenant-1/instances/instance-1/workspace/',
            }),
          }),
        }),
      });
      expect(mockWorkspaceStorage.provisionWorkspace).toHaveBeenCalledWith({
        tenantId,
        instanceId: expect.any(String),
      });
      expect(runtime.enqueueCreateInstance).toHaveBeenCalledWith({
        instanceId: createdInstance.id,
        tenantId,
        tier: 'pro',
        runtimeType: 'docker',
        runtimeClass: 'gvisor',
        containerName: expect.stringMatching(/^agenthub-tenant-1-\d+$/),
        workspace: expect.objectContaining({
          provider: 'minio',
          bucket: 'agenthub-workspaces',
          prefix: 'tenants/tenant-1/instances/instance-1/workspace/',
          accessKey: 'agenthub',
          secretKey: 'agenthub-secret',
        }),
      });
      expect(prisma.instance.update).toHaveBeenCalledWith({
        where: { id: createdInstance.id },
        data: expect.objectContaining({
          observedStatus: 'running',
          health: 'healthy',
          status: 'running',
        }),
      });
      expect(result).toEqual(expect.objectContaining({ observedStatus: 'running' }));
    });
  });

  describe('list', () => {
    it('should return an array of instances for a tenant', async () => {
      const tenantId = 'tenant-1';
      const instances = [
        { id: 'instance-1', tenantId, status: 'running' },
        { id: 'instance-2', tenantId, status: 'pending' },
      ];

      mockPrismaService.instance.findMany.mockResolvedValue(instances);

      const result = await service.list(tenantId);

      expect(prisma.instance.findMany).toHaveBeenCalledWith({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(instances);
    });
  });

  describe('getStatus', () => {
    it('should return instance status from data plane', async () => {
      const containerId = 'container-1';
      const statusResult = { status: 'running', endpoint: 'http://localhost:8080' };

      mockPrismaService.instance.findFirst.mockResolvedValue({
        id: 'instance-1',
        tenantId: 'tenant-1',
        containerId,
        runtimeResourceName: null,
      });
      (mockRuntimeProvider.getInstanceStatus as jest.Mock).mockResolvedValue(statusResult);

      const result = await service.getStatus('tenant-1', 'instance-1');

      expect(runtime.getInstanceStatus).toHaveBeenCalledWith({
        instanceId: 'instance-1',
        containerId,
        runtimeResourceName: undefined,
      });
      expect(result).toEqual(statusResult);
    });
  });

  describe('lifecycle', () => {
    it('should enqueue start and set desired running', async () => {
      mockPrismaService.instance.findFirst.mockResolvedValue({ id: 'instance-1', tenantId: 'tenant-1' });
      mockPrismaService.instance.update
        .mockResolvedValueOnce({ id: 'instance-1', desiredStatus: 'running' })
        .mockResolvedValueOnce({ id: 'instance-1', observedStatus: 'running' });
      (mockRuntimeProvider.getInstanceStatus as jest.Mock).mockResolvedValue({
        observedStatus: 'running',
        health: 'healthy',
      });

      const result = await service.start('tenant-1', 'instance-1');

      expect(runtime.enqueueStartInstance).toHaveBeenCalledWith({ tenantId: 'tenant-1', instanceId: 'instance-1', containerId: undefined });
      expect(prisma.instance.update).toHaveBeenCalledWith({
        where: { id: 'instance-1' },
        data: expect.objectContaining({ desiredStatus: 'running', observedStatus: 'pending' }),
      });
      expect(result).toEqual({ id: 'instance-1', observedStatus: 'running' });
    });

    it('should enqueue stop and set desired stopped', async () => {
      mockPrismaService.instance.findFirst.mockResolvedValue({ id: 'instance-1', tenantId: 'tenant-1' });
      mockPrismaService.instance.update.mockResolvedValue({ id: 'instance-1', desiredStatus: 'stopped' });
      (mockRuntimeProvider.getInstanceStatus as jest.Mock).mockResolvedValue({
        observedStatus: 'stopped',
        health: 'unknown',
      });

      await service.stop('tenant-1', 'instance-1');

      expect(runtime.enqueueStopInstance).toHaveBeenCalledWith({ tenantId: 'tenant-1', instanceId: 'instance-1', containerId: undefined });
      expect(prisma.instance.update).toHaveBeenCalledWith({
        where: { id: 'instance-1' },
        data: expect.objectContaining({ desiredStatus: 'stopped', observedStatus: 'pending' }),
      });
    });

    it('should enqueue delete and set desired deleted', async () => {
      mockPrismaService.instance.findFirst.mockResolvedValue({ id: 'instance-1', tenantId: 'tenant-1' });
      mockPrismaService.instance.update.mockResolvedValue({ id: 'instance-1', desiredStatus: 'deleted' });
      (mockRuntimeProvider.getInstanceStatus as jest.Mock).mockResolvedValue({
        observedStatus: 'deleted',
        health: 'unknown',
      });

      await service.remove('tenant-1', 'instance-1');

      expect(runtime.enqueueDeleteInstance).toHaveBeenCalledWith({ tenantId: 'tenant-1', instanceId: 'instance-1', containerId: undefined });
      expect(prisma.instance.update).toHaveBeenCalledWith({
        where: { id: 'instance-1' },
        data: expect.objectContaining({ desiredStatus: 'deleted', observedStatus: 'pending' }),
      });
    });
  });
});
