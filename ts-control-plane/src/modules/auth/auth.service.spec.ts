import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../../core/database/prisma.service';

const mockPrisma = {
  tenant: {
    create: jest.fn(),
    findUnique: jest.fn(),
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
    it('should hash password and create tenant', async () => {
      const dto = { email: 'test@example.com', password: 'password123', name: 'Test' };
      mockPrisma.tenant.create.mockResolvedValue({ id: '1', ...dto, password: 'hashed-password' });

      await service.register(dto);

      expect(bcrypt.hash).toHaveBeenCalledWith(dto.password, 10);
      expect(mockPrisma.tenant.create).toHaveBeenCalledWith({
        data: {
          email: dto.email,
          password: 'hashed-password',
          name: dto.name,
        },
      });
    });
  });

  describe('login', () => {
    it('should return access_token for valid credentials', async () => {
      const dto = { email: 'test@example.com', password: 'password123' };
      const tenant = { id: '1', email: dto.email, password: 'hashed-password' };
      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login(dto);

      expect(mockPrisma.tenant.findUnique).toHaveBeenCalledWith({ where: { email: dto.email } });
      expect(bcrypt.compare).toHaveBeenCalledWith(dto.password, tenant.password);
      expect(mockJwt.sign).toHaveBeenCalledWith({ sub: tenant.id, email: tenant.email });
      expect(result).toEqual({ access_token: 'test-jwt' });
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      const dto = { email: 'test@example.com', password: 'wrongpassword' };
      const tenant = { id: '1', email: dto.email, password: 'hashed-password' };
      mockPrisma.tenant.findUnique.mockResolvedValue(tenant);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      const dto = { email: 'notfound@example.com', password: 'password123' };
      mockPrisma.tenant.findUnique.mockResolvedValue(null);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });
  });
});
