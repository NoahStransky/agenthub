import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../../core/database/prisma.service';

const mockPrisma = {
  user: {
    count: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
  },
  member: {
    findFirst: jest.fn(),
  },
  tenant: {
    create: jest.fn(),
  },
};

const mockJwt = {
  sign: jest.fn(() => 'test-jwt'),
};

jest.mock('bcrypt', () => ({
  hash: jest.fn(() => 'hashed-password'),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should hash password and create user, tenant, and owner membership', async () => {
      const dto = { email: 'test@example.com', password: 'password123', name: 'Test' };
      mockPrisma.user.count.mockResolvedValue(1);
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-1',
        email: dto.email,
        name: dto.name,
        password: 'hashed-password',
        platformRole: 'user',
        isActive: true,
      });
      mockPrisma.tenant.create.mockResolvedValue({
        id: 'tenant-1',
        name: "Test's Workspace",
        slug: 'test',
        tier: 'free',
        members: [{ id: 'member-1', role: 'owner' }],
      });

      const result = await service.register(dto);

      expect(bcrypt.hash).toHaveBeenCalledWith(dto.password, 10);
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: dto.email,
          password: 'hashed-password',
          name: dto.name,
          platformRole: 'user',
          isActive: true,
        }),
      });
      expect(mockPrisma.tenant.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: "Test's Workspace",
          tier: 'free',
          status: 'active',
          isActive: true,
          members: {
            create: {
              userId: 'user-1',
              role: 'owner',
            },
          },
        }),
        include: { members: true },
      });
      expect(result).toEqual(expect.objectContaining({
        id: 'user-1',
        activeTenantId: 'tenant-1',
        memberRole: 'owner',
      }));
      expect(result).not.toHaveProperty('password');
    });

    it('should make the first registered user a super admin', async () => {
      const dto = { email: 'root@example.com', password: 'password123' };
      mockPrisma.user.count.mockResolvedValue(0);
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-1',
        email: dto.email,
        password: 'hashed-password',
        platformRole: 'super_admin',
        isActive: true,
      });
      mockPrisma.tenant.create.mockResolvedValue({
        id: 'tenant-1',
        members: [{ role: 'owner' }],
      });

      await service.register(dto);

      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ platformRole: 'super_admin' }),
      });
    });
  });

  describe('login', () => {
    it('should return access_token for valid credentials', async () => {
      const dto = { email: 'test@example.com', password: 'password123' };
      const user = {
        id: 'user-1',
        email: dto.email,
        password: 'hashed-password',
        platformRole: 'user',
        isActive: true,
        banned: false,
        memberships: [{ tenantId: 'tenant-1', role: 'owner', tenant: { id: 'tenant-1', isActive: true } }],
      };
      mockPrisma.user.findUnique.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login(dto);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: dto.email },
        include: {
          memberships: {
            include: { tenant: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(dto.password, user.password);
      expect(mockJwt.sign).toHaveBeenCalledWith({
        sub: user.id,
        email: user.email,
        platformRole: user.platformRole,
        activeTenantId: 'tenant-1',
        memberRole: 'owner',
      });
      expect(result).toEqual({ access_token: 'test-jwt' });
    });

    it('should throw UnauthorizedException for inactive user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        isActive: false,
        banned: false,
      });

      await expect(service.login({ email: 'test@example.com', password: 'password123' })).rejects.toThrow(UnauthorizedException);
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        password: 'hashed-password',
        isActive: true,
        banned: false,
        memberships: [],
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login({ email: 'test@example.com', password: 'wrongpassword' })).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login({ email: 'notfound@example.com', password: 'password123' })).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('me', () => {
    it('should return the current user and active tenant without password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        password: 'hashed-password',
        platformRole: 'user',
        isActive: true,
        banned: false,
        memberships: [{
          id: 'member-1',
          role: 'owner',
          tenantId: 'tenant-1',
          tenant: { id: 'tenant-1', name: 'Workspace', isActive: true },
        }],
      });

      const result = await service.me('user-1', 'tenant-1');

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        include: {
          memberships: {
            include: { tenant: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      });
      expect(result).toEqual({
        user: {
          id: 'user-1',
          email: 'test@example.com',
          platformRole: 'user',
          isActive: true,
          banned: false,
        },
        activeTenant: { id: 'tenant-1', name: 'Workspace', isActive: true },
        memberRole: 'owner',
        memberships: [{
          id: 'member-1',
          role: 'owner',
          tenant: { id: 'tenant-1', name: 'Workspace', isActive: true },
        }],
      });
      expect((result as any).user).not.toHaveProperty('password');
    });

    it('should reject inactive users', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        isActive: false,
        banned: false,
      });

      await expect(service.me('user-1')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('issueApiTokenFromBetterAuthRequest', () => {
    it('should issue a JWT for a valid Better Auth session and existing membership', async () => {
      (service as any).betterAuth = {
        api: {
          getSession: jest.fn().mockResolvedValue({
            user: {
              id: 'user-1',
              email: 'test@example.com',
              name: 'Test',
              platformRole: 'admin',
            },
            session: { id: 'session-1' },
          }),
        },
      };
      mockPrisma.member.findFirst.mockResolvedValue({
        id: 'member-1',
        userId: 'user-1',
        tenantId: 'tenant-1',
        role: 'owner',
        tenant: { id: 'tenant-1', isActive: true },
      });

      const result = await service.issueApiTokenFromBetterAuthRequest({
        headers: { cookie: 'better-auth.session_token=signed-token' },
      });

      expect(mockPrisma.member.findFirst).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          tenant: { isActive: true },
        },
        include: { tenant: true },
        orderBy: { createdAt: 'asc' },
      });
      expect(mockJwt.sign).toHaveBeenCalledWith({
        sub: 'user-1',
        email: 'test@example.com',
        platformRole: 'admin',
        activeTenantId: 'tenant-1',
        memberRole: 'owner',
      });
      expect(result).toEqual({ access_token: 'test-jwt' });
    });

    it('should bootstrap a default tenant when a Better Auth user has no memberships', async () => {
      (service as any).betterAuth = {
        api: {
          getSession: jest.fn().mockResolvedValue({
            user: {
              id: 'user-1',
              email: 'test@example.com',
              name: 'Test',
              platformRole: 'user',
            },
          }),
        },
      };
      mockPrisma.member.findFirst.mockResolvedValue(null);
      mockPrisma.tenant.create.mockResolvedValue({
        id: 'tenant-1',
        members: [{ id: 'member-1', tenantId: 'tenant-1', role: 'owner' }],
      });

      await service.issueApiTokenFromBetterAuthRequest({ headers: {} });

      expect(mockPrisma.tenant.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: "Test's Workspace",
          slug: 'test-user-1',
          tier: 'free',
          status: 'active',
          isActive: true,
          members: {
            create: {
              userId: 'user-1',
              role: 'owner',
            },
          },
        }),
        include: { members: true },
      });
      expect(mockJwt.sign).toHaveBeenCalledWith(expect.objectContaining({
        activeTenantId: 'tenant-1',
        memberRole: 'owner',
      }));
    });

    it('should reject missing Better Auth sessions', async () => {
      (service as any).betterAuth = {
        api: {
          getSession: jest.fn().mockResolvedValue(null),
        },
      };

      await expect(service.issueApiTokenFromBetterAuthRequest({ headers: {} })).rejects.toThrow(UnauthorizedException);
    });
  });
});
