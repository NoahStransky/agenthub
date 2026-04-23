import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '@core/database/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UnauthorizedException, ConflictException } from '@nestjs/common';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any;
  let jwtService: JwtService;

  const mockPrismaService = {
    tenant: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  const mockJwtService = {
    sign: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);

    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should create a tenant and return a JWT token', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      const hashedPassword = 'hashedPassword123';
      const tenant = { id: 'tenant-1', email, password: hashedPassword };
      const token = 'jwt-token-123';

      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      mockPrismaService.tenant.create.mockResolvedValue(tenant);
      mockJwtService.sign.mockReturnValue(token);

      const result = await service.register(email, password);

      expect(bcrypt.hash).toHaveBeenCalledWith(password, 10);
      expect(prisma.tenant.create).toHaveBeenCalledWith({
        data: { email, password: hashedPassword },
      });
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: tenant.id,
        email: tenant.email,
      });
      expect(result).toEqual({ access_token: token });
    });

    it('should throw ConflictException if email already exists', async () => {
      const email = 'test@example.com';
      const password = 'password123';

      mockPrismaService.tenant.create.mockRejectedValue({
        code: 'P2002',
        meta: { target: ['email'] },
      });

      await expect(service.register(email, password)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('login', () => {
    it('should validate credentials and return a JWT token', async () => {
      const email = 'test@example.com';
      const password = 'password123';
      const tenant = { id: 'tenant-1', email, password: 'hashedPassword123' };
      const token = 'jwt-token-123';

      mockPrismaService.tenant.findUnique.mockResolvedValue(tenant);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.sign.mockReturnValue(token);

      const result = await service.login(email, password);

      expect(prisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { email },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(password, tenant.password);
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: tenant.id,
        email: tenant.email,
      });
      expect(result).toEqual({ access_token: token });
    });

    it('should throw UnauthorizedException if tenant not found', async () => {
      mockPrismaService.tenant.findUnique.mockResolvedValue(null);

      await expect(
        service.login('missing@example.com', 'password123'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password is invalid', async () => {
      const tenant = { id: 'tenant-1', email: 'test@example.com', password: 'hashed' };

      mockPrismaService.tenant.findUnique.mockResolvedValue(tenant);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login('test@example.com', 'wrongpassword'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
