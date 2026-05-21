import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';

@Injectable()
export class AdminRoleGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.userId;

    if (!userId) {
      throw new ForbiddenException('Access denied: no user context');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !['admin', 'super_admin'].includes(user.platformRole)) {
      throw new ForbiddenException('Access denied: admin role required');
    }

    return true;
  }
}
