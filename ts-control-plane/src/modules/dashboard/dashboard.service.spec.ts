import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '@core/database/prisma.service';
import { BillingService } from '@modules/billing/billing.service';
import { RedisService } from '@core/redis/redis.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: any;
  let billingService: any;

  const mockRedisService = {
    getClient: jest.fn().mockReturnValue({
      hget: jest.fn(),
      hgetall: jest.fn(),
      pipeline: jest.fn().mockReturnValue({
        hincrby: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn(),
      }),
    }),
  };

  const mockPrismaService = {
    instance: {
      count: jest.fn(),
    },
    task: {
      count: jest.fn(),
    },
    project: {
      count: jest.fn(),
    },
    tenant: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  const mockBillingService = {
    getUsage: jest.fn(),
    getQuota: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: BillingService, useValue: mockBillingService },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    prisma = module.get<PrismaService>(PrismaService);
    billingService = module.get<BillingService>(BillingService);

    jest.clearAllMocks();
  });

  describe('getStats', () => {
    it('should return stats for a tenant', async () => {
      const tenantId = 'tenant-1';

      mockPrismaService.instance.count.mockResolvedValue(3);
      mockPrismaService.task.count.mockResolvedValue(10);
      mockPrismaService.project.count.mockResolvedValue(2);
      mockPrismaService.tenant.findUnique.mockResolvedValue({
        id: tenantId,
        tier: 'free',
      });
      mockBillingService.getUsage.mockResolvedValue({
        promptTokens: 500,
        completionTokens: 300,
        totalTokens: 800,
      });

      const result = await service.getStats(tenantId);

      expect(prisma.instance.count).toHaveBeenCalledWith({ where: { tenantId } });
      expect(prisma.task.count).toHaveBeenCalledWith({ where: { tenantId } });
      expect(prisma.project.count).toHaveBeenCalledWith({ where: { tenantId } });
      expect(billingService.getUsage).toHaveBeenCalledWith(tenantId);
      expect(result).toEqual({
        instances: 3,
        tasks: 10,
        projects: 2,
        usage: {
          promptTokens: 500,
          completionTokens: 300,
          totalTokens: 800,
        },
        quota: 10000,
      });
    });
  });

  describe('getMe', () => {
    it('should return tenant info without password', async () => {
      const tenantId = 'tenant-1';
      const tenantData = {
        id: tenantId,
        email: 'test@example.com',
        password: 'secret',
        name: 'Test User',
        role: 'user',
        tier: 'pro',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.tenant.findUnique.mockResolvedValue(tenantData);

      const result = await service.getMe(tenantId);

      expect(prisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { id: tenantId },
      });
      expect(result).toEqual({
        id: tenantId,
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        tier: 'pro',
        isActive: true,
        createdAt: tenantData.createdAt,
        updatedAt: tenantData.updatedAt,
      });
      expect((result as any).password).toBeUndefined();
    });

    it('should return null for non-existent tenant', async () => {
      mockPrismaService.tenant.findUnique.mockResolvedValue(null);
      const result = await service.getMe('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('getProvider', () => {
    it('should return provider list', async () => {
      const result = await service.getProvider();
      expect(result).toEqual({
        providers: expect.arrayContaining([
          expect.objectContaining({ id: expect.any(String), name: expect.any(String) }),
        ]),
      });
    });
  });
});
