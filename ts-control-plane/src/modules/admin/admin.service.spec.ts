import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { PrismaService } from '@core/database/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('AdminService', () => {
  let service: AdminService;
  let prisma: any;

  const mockPrismaService = {
    tenant: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    systemConfig: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    prisma = mockPrismaService;
    jest.clearAllMocks();
  });

  describe('listUsers', () => {
    it('should return paginated users list without search', async () => {
      const users = [
        { id: '1', email: 'a@test.com', name: 'User A', role: 'user', tier: 'free', isActive: true, createdAt: new Date(), updatedAt: new Date() },
      ];
      mockPrismaService.tenant.findMany.mockResolvedValue(users);
      mockPrismaService.tenant.count.mockResolvedValue(1);

      const result = await service.listUsers(1, 20);

      expect(prisma.tenant.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 20,
        select: expect.objectContaining({
          id: true,
          email: true,
          name: true,
        }),
      });
      expect(prisma.tenant.count).toHaveBeenCalledWith({ where: {} });
      expect(result).toEqual({ users, total: 1, page: 1, limit: 20 });
    });

    it('should apply search filter when search param is provided', async () => {
      mockPrismaService.tenant.findMany.mockResolvedValue([]);
      mockPrismaService.tenant.count.mockResolvedValue(0);

      await service.listUsers(1, 20, 'test@example.com');

      expect(prisma.tenant.findMany).toHaveBeenCalledWith({
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

    it('should compute skip offset correctly from page and limit', async () => {
      mockPrismaService.tenant.findMany.mockResolvedValue([]);
      mockPrismaService.tenant.count.mockResolvedValue(0);

      await service.listUsers(3, 10);

      expect(prisma.tenant.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });
  });

  describe('getUser', () => {
    it('should return user by id without password', async () => {
      const user = { id: '1', email: 'a@test.com', name: 'Test', role: 'user', tier: 'free', isActive: true, createdAt: new Date(), updatedAt: new Date() };
      mockPrismaService.tenant.findUnique.mockResolvedValue(user);

      const result = await service.getUser('1');

      expect(prisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
        select: expect.objectContaining({
          id: true,
          email: true,
          name: true,
        }),
      });
      expect(result).toEqual(user);
    });

    it('should throw NotFoundException when user does not exist', async () => {
      mockPrismaService.tenant.findUnique.mockResolvedValue(null);

      await expect(service.getUser('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateUserStatus', () => {
    it('should update user isActive status', async () => {
      const existingUser = { id: '1', email: 'a@test.com' };
      const updatedUser = { id: '1', email: 'a@test.com', isActive: false, name: 'Test', role: 'user', tier: 'free', createdAt: new Date(), updatedAt: new Date() };

      mockPrismaService.tenant.findUnique.mockResolvedValue(existingUser);
      mockPrismaService.tenant.update.mockResolvedValue(updatedUser);

      const result = await service.updateUserStatus('1', false);

      expect(prisma.tenant.findUnique).toHaveBeenCalledWith({ where: { id: '1' } });
      expect(prisma.tenant.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { isActive: false },
        select: expect.any(Object),
      });
      expect(result).toEqual(updatedUser);
    });

    it('should throw NotFoundException when user to update does not exist', async () => {
      mockPrismaService.tenant.findUnique.mockResolvedValue(null);

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
