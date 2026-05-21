import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { PrismaService } from '@core/database/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { BillingService } from '@modules/billing/billing.service';

describe('AdminService', () => {
  let service: AdminService;
  let prisma: any;

  const mockPrismaService = {
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    tenant: {
      count: jest.fn(),
    },
    systemConfig: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    instance: {
      count: jest.fn(),
    },
    task: {
      count: jest.fn(),
    },
  };
  const mockBillingService = {
    getUsage: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: BillingService, useValue: mockBillingService },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    prisma = mockPrismaService;
    jest.clearAllMocks();
  });

  describe('listUsers', () => {
    it('should return paginated platform users list without search', async () => {
      const users = [
        { id: '1', email: 'a@test.com', name: 'User A', platformRole: 'user', isActive: true, banned: false, createdAt: new Date(), updatedAt: new Date() },
      ];
      mockPrismaService.user.findMany.mockResolvedValue(users);
      mockPrismaService.user.count.mockResolvedValue(1);

      const result = await service.listUsers(1, 20);

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 20,
        select: expect.objectContaining({
          id: true,
          email: true,
          name: true,
          platformRole: true,
        }),
      });
      expect(prisma.user.count).toHaveBeenCalledWith({ where: {} });
      expect(result).toEqual({ users, total: 1, page: 1, limit: 20 });
    });

    it('should apply search filter when search param is provided', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.user.count.mockResolvedValue(0);

      await service.listUsers(1, 20, 'test@example.com');

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { email: { contains: 'test@example.com', mode: 'insensitive' } },
            { name: { contains: 'test@example.com', mode: 'insensitive' } },
          ],
        },
        skip: 0,
        take: 20,
        select: expect.any(Object),
      });
    });
  });

  describe('getUser', () => {
    it('should return user by id without password', async () => {
      const user = { id: '1', email: 'a@test.com', name: 'Test', platformRole: 'user', isActive: true, banned: false, createdAt: new Date(), updatedAt: new Date() };
      mockPrismaService.user.findUnique.mockResolvedValue(user);

      const result = await service.getUser('1');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
        select: expect.objectContaining({
          id: true,
          email: true,
          name: true,
          memberships: expect.any(Object),
        }),
      });
      expect(result).toEqual(user);
    });

    it('should throw NotFoundException when user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.getUser('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getStats', () => {
    it('should return platform stats', async () => {
      mockPrismaService.user.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(8);
      mockPrismaService.tenant.count
        .mockResolvedValueOnce(4)
        .mockResolvedValueOnce(3);
      mockPrismaService.instance.count
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(3);
      mockPrismaService.task.count
        .mockResolvedValueOnce(20)
        .mockResolvedValueOnce(4);

      const result = await service.getStats();

      expect(result).toEqual({
        users: { total: 10, active: 8 },
        tenants: { total: 4, active: 3 },
        instances: { total: 5, running: 3 },
        tasks: { total: 20, inProgress: 4 },
      });
    });
  });

  describe('getUserUsage', () => {
    it('should return usage for the user active tenant', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-1',
        memberships: [{ tenantId: 'tenant-1' }],
      });
      mockBillingService.getUsage.mockResolvedValue({ totalTokens: 42 });

      const result = await service.getUserUsage('user-1');

      expect(mockBillingService.getUsage).toHaveBeenCalledWith('tenant-1');
      expect(result).toEqual({ totalTokens: 42 });
    });

    it('should throw NotFoundException when user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.getUserUsage('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateUserStatus', () => {
    it('should update user isActive status', async () => {
      const existingUser = { id: '1', email: 'a@test.com' };
      const updatedUser = { id: '1', email: 'a@test.com', isActive: false, name: 'Test', platformRole: 'user', banned: false, createdAt: new Date(), updatedAt: new Date() };

      mockPrismaService.user.findUnique.mockResolvedValue(existingUser);
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.updateUserStatus('1', false);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: '1' } });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { isActive: false },
        select: expect.any(Object),
      });
      expect(result).toEqual(updatedUser);
    });

    it('should throw NotFoundException when user to update does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.updateUserStatus('nonexistent', true)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getConfig', () => {
    it('should return all system configs', async () => {
      const configs = [
        { id: '1', key: 'MAX_INSTANCES', value: '10', updatedAt: new Date() },
      ];
      mockPrismaService.systemConfig.findMany.mockResolvedValue(configs);

      const result = await service.getConfig();

      expect(prisma.systemConfig.findMany).toHaveBeenCalled();
      expect(result).toEqual({ configs });
    });
  });

  describe('updateConfig', () => {
    it('should upsert a system config', async () => {
      const config = { id: '1', key: 'MAX_INSTANCES', value: '20', updatedAt: new Date() };
      mockPrismaService.systemConfig.upsert.mockResolvedValue(config);

      const result = await service.updateConfig('MAX_INSTANCES', '20');

      expect(prisma.systemConfig.upsert).toHaveBeenCalledWith({
        where: { key: 'MAX_INSTANCES' },
        update: { value: '20' },
        create: { key: 'MAX_INSTANCES', value: '20' },
      });
      expect(result).toEqual(config);
    });
  });
});
