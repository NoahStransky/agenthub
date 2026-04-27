import { Test, TestingModule } from '@nestjs/testing';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '@core/database/prisma.service';
import { BillingService } from '@modules/billing/billing.service';
import { RedisService } from '@core/redis/redis.service';

describe('DashboardController', () => {
  let controller: DashboardController;
  let dashboardService: any;

  const mockDashboardService = {
    getStats: jest.fn(),
    getMe: jest.fn(),
    getProvider: jest.fn(),
  };

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
    instance: { count: jest.fn() },
    task: { count: jest.fn() },
    project: { count: jest.fn() },
    tenant: { findUnique: jest.fn(), findFirst: jest.fn() },
  };

  const mockBillingService = {
    getUsage: jest.fn(),
    checkQuota: jest.fn(),
    recordUsage: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        { provide: DashboardService, useValue: mockDashboardService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: BillingService, useValue: mockBillingService },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    controller = module.get<DashboardController>(DashboardController);
    dashboardService = module.get<DashboardService>(DashboardService);

    jest.clearAllMocks();
  });

  describe('getStats', () => {
    it('should return stats for the authenticated user', async () => {
      const req = { user: { tenantId: 'tenant-1' } };
      const expectedStats = {
        instances: 3,
        tasks: 10,
        projects: 2,
        usage: { promptTokens: 500, completionTokens: 300, totalTokens: 800 },
        quota: 10000,
      };

      mockDashboardService.getStats.mockResolvedValue(expectedStats);

      const result = await controller.getStats(req as any);

      expect(dashboardService.getStats).toHaveBeenCalledWith('tenant-1');
      expect(result).toEqual(expectedStats);
    });
  });

  describe('getMe', () => {
    it('should return current user info', async () => {
      const req = { user: { tenantId: 'tenant-1' } };
      const expectedUser = {
        id: 'tenant-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        tier: 'pro',
        isActive: true,
      };

      mockDashboardService.getMe.mockResolvedValue(expectedUser);

      const result = await controller.getMe(req as any);

      expect(dashboardService.getMe).toHaveBeenCalledWith('tenant-1');
      expect(result).toEqual(expectedUser);
    });
  });

  describe('getProvider', () => {
    it('should return provider list', async () => {
      const expectedProviders = {
        providers: [
          { id: 'openai', name: 'OpenAI' },
          { id: 'anthropic', name: 'Anthropic' },
        ],
      };

      mockDashboardService.getProvider.mockResolvedValue(expectedProviders);

      const result = await controller.getProvider();

      expect(dashboardService.getProvider).toHaveBeenCalled();
      expect(result).toEqual(expectedProviders);
    });
  });
});
