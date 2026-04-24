import { Test, TestingModule } from '@nestjs/testing';
import { BillingService, UsageStats } from './billing.service';
import { PrismaService } from '@core/database/prisma.service';
import { RedisService } from '@core/redis/redis.service';

describe('BillingService', () => {
  let service: BillingService;
  let prisma: any;
  let redis: any;

  const mockRedisClient = {
    hget: jest.fn(),
    hgetall: jest.fn(),
    hincrby: jest.fn(),
    pipeline: jest.fn(),
    expire: jest.fn(),
    exec: jest.fn(),
  };

  const mockPipeline = {
    hincrby: jest.fn().mockReturnThis(),
    expire: jest.fn().mockReturnThis(),
    exec: jest.fn(),
  };

  const mockPrismaService = {
    tenant: {
      findUnique: jest.fn(),
    },
  };

  const mockRedisService = {
    getClient: jest.fn().mockReturnValue(mockRedisClient),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
    prisma = module.get<PrismaService>(PrismaService);
    redis = mockRedisClient;

    mockRedisClient.pipeline.mockReturnValue(mockPipeline);
    jest.clearAllMocks();
  });

  describe('checkQuota', () => {
    it('should return true when usage is within quota', async () => {
      const tenantId = 'tenant-1';
      const tenant = { id: tenantId, tier: 'free', isActive: true };
      mockPrismaService.tenant.findUnique.mockResolvedValue(tenant);
      mockRedisClient.hget.mockResolvedValue('1000');

      const result = await service.checkQuota(tenantId, 5000);

      expect(prisma.tenant.findUnique).toHaveBeenCalledWith({ where: { id: tenantId } });
      expect(redis.hget).toHaveBeenCalledWith(expect.stringContaining(`agenthub:usage:${tenantId}`), 'totalTokens');
      expect(result).toBe(true);
    });

    it('should return false when quota would be exceeded', async () => {
      const tenantId = 'tenant-1';
      const tenant = { id: tenantId, tier: 'free', isActive: true };
      mockPrismaService.tenant.findUnique.mockResolvedValue(tenant);
      mockRedisClient.hget.mockResolvedValue('6000');

      const result = await service.checkQuota(tenantId, 5000);

      expect(result).toBe(false);
    });

    it('should return false when tenant does not exist', async () => {
      mockPrismaService.tenant.findUnique.mockResolvedValue(null);

      const result = await service.checkQuota('unknown', 100);

      expect(result).toBe(false);
    });

    it('should return false when tenant is inactive', async () => {
      const tenant = { id: 'tenant-1', tier: 'free', isActive: false };
      mockPrismaService.tenant.findUnique.mockResolvedValue(tenant);

      const result = await service.checkQuota('tenant-1', 100);

      expect(result).toBe(false);
    });

    it('should use plan quota based on tier', async () => {
      const tenant = { id: 'tenant-1', tier: 'pro', isActive: true };
      mockPrismaService.tenant.findUnique.mockResolvedValue(tenant);
      mockRedisClient.hget.mockResolvedValue('50000');

      const result = await service.checkQuota('tenant-1', 50000);

      expect(result).toBe(true);
    });
  });

  describe('recordUsage', () => {
    it('should increment usage counters in Redis', async () => {
      const tenantId = 'tenant-1';
      const usage = { promptTokens: 10, completionTokens: 20, totalTokens: 30 };
      mockPipeline.exec.mockResolvedValue([]);

      await service.recordUsage(tenantId, usage);

      expect(mockPipeline.hincrby).toHaveBeenCalledWith(expect.stringContaining(`agenthub:usage:${tenantId}`), 'promptTokens', 10);
      expect(mockPipeline.hincrby).toHaveBeenCalledWith(expect.stringContaining(`agenthub:usage:${tenantId}`), 'completionTokens', 20);
      expect(mockPipeline.hincrby).toHaveBeenCalledWith(expect.stringContaining(`agenthub:usage:${tenantId}`), 'totalTokens', 30);
      expect(mockPipeline.expire).toHaveBeenCalledWith(expect.stringContaining(`agenthub:usage:${tenantId}`), 60 * 60 * 24 * 7);
      expect(mockPipeline.exec).toHaveBeenCalled();
    });
  });

  describe('getUsage', () => {
    it('should return usage stats from Redis', async () => {
      const tenantId = 'tenant-1';
      mockRedisClient.hgetall.mockResolvedValue({
        promptTokens: '10',
        completionTokens: '20',
        totalTokens: '30',
      });

      const result = await service.getUsage(tenantId);

      expect(redis.hgetall).toHaveBeenCalledWith(expect.stringContaining(`agenthub:usage:${tenantId}`));
      expect(result).toEqual<UsageStats>({
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      });
    });

    it('should return zero values when no usage exists', async () => {
      mockRedisClient.hgetall.mockResolvedValue({});

      const result = await service.getUsage('tenant-1');

      expect(result).toEqual<UsageStats>({
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      });
    });
  });
});
