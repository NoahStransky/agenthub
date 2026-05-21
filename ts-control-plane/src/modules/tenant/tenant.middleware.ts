import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@core/database/prisma.service';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.substring(7);

    try {
      const payload = this.jwtService.verify<{ sub: string; email: string; activeTenantId?: string }>(token);
      const userId = payload.sub;
      const tenantId = payload.activeTenantId;

      if (!tenantId) {
        throw new UnauthorizedException('Missing active tenant');
      }

      const membership = await this.prisma.member.findFirst({
        where: {
          userId,
          tenantId,
          tenant: { isActive: true },
          user: { isActive: true, banned: false },
        },
      });

      if (!membership) {
        throw new UnauthorizedException('Tenant membership not found or inactive');
      }

      (req as any).userId = userId;
      (req as any).tenantId = tenantId;
      (req as any).memberRole = membership.role;
      next();
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid token');
    }
  }
}
