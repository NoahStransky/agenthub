import { Test, TestingModule } from '@nestjs/testing';
import { InstanceService } from './instance.service';
import { PrismaService } from '@core/database/prisma.service';
import { DATA_PLANE_CLIENT, IDataPlaneClient } from '@core/grpc/data-plane.client';

describe('InstanceService', () => {
  let service: InstanceService;
  let prisma: any;
  let dataPlane: IDataPlaneClient;

  const mockPrismaService = {
    instance: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockDataPlaneClient: IDataPlaneClient = {
    createInstance: jest.fn(),
    getInstanceStatus: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InstanceService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: DATA_PLANE_CLIENT, useValue: mockDataPlaneClient },
      ],
    }).compile();

    service = module.get<InstanceService>(InstanceService);
    prisma = module.get<PrismaService>(PrismaService);
    dataPlane = module.get<IDataPlaneClient>(DATA_PLANE_CLIENT);

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create an instance and return it', async () => {
      const tenantId = 'tenant-1';
      const tier = 'pro';
      const createdInstance = {
        id: 'instance-1',
        tenantId,
        containerName: 'agenthub-tenant-1-123456',
        status: 'pending',
        endpoint: null,
        containerId: null,
      };
      const dataPlaneResult = {
        containerId: 'container-1',
        endpoint: 'http://localhost:8080',
      };
      const updatedInstance = {
        ...createdInstance,
        containerId: dataPlaneResult.containerId,
        endpoint: dataPlaneResult.endpoint,
        status: 'running',
      };

      mockPrismaService.instance.create.mockResolvedValue(createdInstance);
      (mockDataPlaneClient.createInstance as jest.Mock).mockResolvedValue(dataPlaneResult);
      mockPrismaService.instance.update.mockResolvedValue(updatedInstance);

      const result = await service.create(tenantId, tier);

      expect(prisma.instance.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId,
          containerName: expect.any(String),
          status: 'pending',
        }),
      });
      expect(dataPlane.createInstance).toHaveBeenCalledWith({ tenantId, tier });
      expect(prisma.instance.update).toHaveBeenCalledWith({
        where: { id: createdInstance.id },
        data: {
          containerId: dataPlaneResult.containerId,
          endpoint: dataPlaneResult.endpoint,
          status: 'running',
        },
      });
      expect(result).toEqual(updatedInstance);
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
      });
      expect(result).toEqual(instances);
    });
  });

  describe('getStatus', () => {
    it('should return instance status from data plane', async () => {
      const containerId = 'container-1';
      const statusResult = { status: 'running', endpoint: 'http://localhost:8080' };

      (mockDataPlaneClient.getInstanceStatus as jest.Mock).mockResolvedValue(statusResult);

      const result = await service.getStatus(containerId);

      expect(dataPlane.getInstanceStatus).toHaveBeenCalledWith({ containerId });
      expect(result).toEqual(statusResult);
    });
  });
});
