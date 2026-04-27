import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminRoleGuard } from './guards/admin-role.guard';
import { CanActivate } from '@nestjs/common';

describe('AdminController', () => {
  let controller: AdminController;
  let adminService: any;

  const mockAdminService = {
    listUsers: jest.fn(),
    getUser: jest.fn(),
    updateUserStatus: jest.fn(),
    getConfig: jest.fn(),
    updateConfig: jest.fn(),
  };

  // Mock the guards so they always pass
  const mockAuthGuard: CanActivate = { canActivate: jest.fn(() => true) };
  const mockAdminRoleGuard: CanActivate = { canActivate: jest.fn(() => true) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: AdminService, useValue: mockAdminService },
      ],
    })
      .overrideGuard(AdminRoleGuard)
      .useValue(mockAdminRoleGuard)
      .compile();

    controller = module.get<AdminController>(AdminController);
    adminService = mockAdminService;
    jest.clearAllMocks();
  });

  describe('GET /admin/users', () => {
    it('should call listUsers with pagination params', async () => {
      const expectedResult = { users: [], total: 0, page: 1, limit: 20 };
      mockAdminService.listUsers.mockResolvedValue(expectedResult);

      const result = await controller.listUsers('1', '20', undefined);

      expect(adminService.listUsers).toHaveBeenCalledWith(1, 20, undefined);
      expect(result).toEqual(expectedResult);
    });

    it('should pass search query to service', async () => {
      mockAdminService.listUsers.mockResolvedValue({ users: [], total: 0, page: 1, limit: 20 });

      await controller.listUsers('1', '20', 'test@example.com');

      expect(adminService.listUsers).toHaveBeenCalledWith(1, 20, 'test@example.com');
    });

    it('should cap limit at 100', async () => {
      mockAdminService.listUsers.mockResolvedValue({ users: [], total: 0, page: 1, limit: 50 });

      await controller.listUsers('1', '200', undefined);

      expect(adminService.listUsers).toHaveBeenCalledWith(1, 100, undefined);
    });
  });

  describe('GET /admin/users/:id', () => {
    it('should call getUser with id', async () => {
      const user = { id: '1', email: 'a@test.com' };
      mockAdminService.getUser.mockResolvedValue(user);

      const result = await controller.getUser('1');

      expect(adminService.getUser).toHaveBeenCalledWith('1');
      expect(result).toEqual(user);
    });
  });

  describe('PATCH /admin/users/:id/status', () => {
    it('should call updateUserStatus with id and isActive', async () => {
      const updatedUser = { id: '1', isActive: false };
      mockAdminService.updateUserStatus.mockResolvedValue(updatedUser);

      const result = await controller.updateUserStatus('1', false);

      expect(adminService.updateUserStatus).toHaveBeenCalledWith('1', false);
      expect(result).toEqual(updatedUser);
    });
  });

  describe('GET /admin/config', () => {
    it('should call getConfig', async () => {
      const configs = { configs: [{ key: 'MAX_INSTANCES', value: '10' }] };
      mockAdminService.getConfig.mockResolvedValue(configs);

      const result = await controller.getConfig();

      expect(adminService.getConfig).toHaveBeenCalled();
      expect(result).toEqual(configs);
    });
  });

  describe('PUT /admin/config', () => {
    it('should call updateConfig with key and value', async () => {
      const config = { id: '1', key: 'MAX_INSTANCES', value: '20' };
      mockAdminService.updateConfig.mockResolvedValue(config);

      const result = await controller.updateConfig('MAX_INSTANCES', '20');

      expect(adminService.updateConfig).toHaveBeenCalledWith('MAX_INSTANCES', '20');
      expect(result).toEqual(config);
    });
  });
});
