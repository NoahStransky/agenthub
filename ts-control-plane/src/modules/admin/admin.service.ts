import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

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
      this.prisma.tenant.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          tier: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.tenant.count({ where }),
    ]);

    return { users, total, page, limit };
  }

  async getUser(id: string) {
    const user = await this.prisma.tenant.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        tier: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    return user;
  }

  async updateUserStatus(id: string, isActive: boolean) {
    const user = await this.prisma.tenant.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    return this.prisma.tenant.update({
      where: { id },
      data: { isActive },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        tier: true,
        isActive: true,
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
