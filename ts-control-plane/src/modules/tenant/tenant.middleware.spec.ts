import { Test, TestingModule } from '@nestjs/testing';
import { TenantMiddleware } from './tenant.middleware';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@core/database/prisma.service';
import { UnauthorizedException } from '@nestjs/common';
import { Request, Response } from 'express';

describe('TenantMiddleware', () => {
  let middleware: TenantMiddleware;
  let jwtService: JwtService;
  let prisma: any;

  const mockJwtService = {
    verify: jest.fn(),
  };

  const mockPrismaService = {
    tenant: {
      findUnique: jest.fn(),
    },
  };

  const mockNext = jest.fn();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantMiddleware,
        { provide: JwtService, useValue: mockJwtService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    middleware = module.get<TenantMiddleware>(TenantMiddleware);
    jwtService = module.get<JwtService>(JwtService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should attach tenantId to request when token is valid and tenant exists', async () => {
    const tenantId = 'tenant-1';
    const token = 'valid-token';
    const req = {
      headers: { authorization: `Bearer ${token}` },
    } as unknown as Request;
    const res = {} as Response;

    mockJwtService.verify.mockReturnValue({ sub: tenantId, email: 'test@example.com' });
    mockPrismaService.tenant.findUnique.mockResolvedValue({ id: tenantId, isActive: true });

    await middleware.use(req, res, mockNext);

    expect(jwtService.verify).toHaveBeenCalledWith(token);
    expect(prisma.tenant.findUnique).toHaveBeenCalledWith({ where: { id: tenantId } });
    expect((req as any).tenantId).toBe(tenantId);
    expect(mockNext).toHaveBeenCalled();
  });

  it('should throw UnauthorizedException when Authorization header is missing', async () => {
    const req = { headers: {} } as Request;
    const res = {} as Response;

    await expect(middleware.use(req, res, mockNext)).rejects.toThrow(UnauthorizedException);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should throw UnauthorizedException when token format is invalid', async () => {
    const req = { headers: { authorization: 'Basic abc123' } } as Request;
    const res = {} as Response;

    await expect(middleware.use(req, res, mockNext)).rejects.toThrow(UnauthorizedException);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should throw UnauthorizedException when token verification fails', async () => {
    const req = { headers: { authorization: 'Bearer invalid-token' } } as Request;
    const res = {} as Response;

    mockJwtService.verify.mockImplementation(() => {
      throw new Error('invalid token');
    });

    await expect(middleware.use(req, res, mockNext)).rejects.toThrow(UnauthorizedException);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should throw UnauthorizedException when tenant does not exist', async () => {
    const req = { headers: { authorization: 'Bearer valid-token' } } as Request;
    const res = {} as Response;

    mockJwtService.verify.mockReturnValue({ sub: 'missing-tenant', email: 'test@example.com' });
    mockPrismaService.tenant.findUnique.mockResolvedValue(null);

    await expect(middleware.use(req, res, mockNext)).rejects.toThrow(UnauthorizedException);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should throw UnauthorizedException when tenant is inactive', async () => {
    const req = { headers: { authorization: 'Bearer valid-token' } } as Request;
    const res = {} as Response;

    mockJwtService.verify.mockReturnValue({ sub: 'tenant-1', email: 'test@example.com' });
    mockPrismaService.tenant.findUnique.mockResolvedValue({ id: 'tenant-1', isActive: false });

    await expect(middleware.use(req, res, mockNext)).rejects.toThrow(UnauthorizedException);
    expect(mockNext).not.toHaveBeenCalled();
  });
});
