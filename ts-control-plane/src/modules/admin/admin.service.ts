import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { BillingService } from '@modules/billing/billing.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billingService: BillingService,
  ) {}

  async listUsers(page: number = 1, limit: number = 20, search?: string) {
    const skip = (page - 1) * limit;

    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' as const } },
            { name: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          name: true,
          platformRole: true,
          isActive: true,
          banned: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { users, total, page, limit };
  }

  async getUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        platformRole: true,
        isActive: true,
        banned: true,
        createdAt: true,
        updatedAt: true,
        memberships: {
          select: {
            id: true,
            role: true,
            tenant: {
              select: {
                id: true,
                name: true,
                slug: true,
                tier: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    return user;
  }

  async getStats() {
    const [users, activeUsers, tenants, activeTenants, instances, runningInstances, tasks, inProgressTasks] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isActive: true, banned: false } }),
      this.prisma.tenant.count(),
      this.prisma.tenant.count({ where: { isActive: true } }),
      this.prisma.instance.count(),
      this.prisma.instance.count({ where: { observedStatus: 'running' } as any }),
      this.prisma.task.count(),
      this.prisma.task.count({ where: { status: { in: ['pending', 'running', 'queued_blocked'] } } as any }),
    ]);

    return {
      users: { total: users, active: activeUsers },
      tenants: { total: tenants, active: activeTenants },
      instances: { total: instances, running: runningInstances },
      tasks: { total: tasks, inProgress: inProgressTasks },
    };
  }

  async getUserUsage(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { memberships: { orderBy: { createdAt: 'asc' } } },
    });

    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    const activeTenantId = user.memberships[0]?.tenantId;
    if (!activeTenantId) {
      return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    }

    return this.billingService.getUsage(activeTenantId);
  }

  async updateUserStatus(id: string, isActive: boolean) {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    return this.prisma.user.update({
      where: { id },
      data: { isActive },
      select: {
        id: true,
        email: true,
        name: true,
        platformRole: true,
        isActive: true,
        banned: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async getConfig() {
    const configs = await this.prisma.systemConfig.findMany();
    return { configs };
  }

  async updateConfig(key: string, value: string) {
    const config = await this.prisma.systemConfig.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });

    return config;
  }
}
