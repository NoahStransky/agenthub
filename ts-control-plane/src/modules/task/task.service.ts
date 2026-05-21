import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';

@Injectable()
export class TaskService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateTaskDto) {
    let status = 'pending';

    if (dto.instanceId) {
      const instance = await this.prisma.instance.findFirst({
        where: { id: dto.instanceId, tenantId },
      });

      if (!instance) {
        throw new NotFoundException(`Instance with id ${dto.instanceId} not found`);
      }

      if ((instance as any).observedStatus !== 'running' || (instance as any).health === 'unhealthy') {
        status = 'queued_blocked';
      }
    }

    return this.prisma.task.create({
      data: {
        tenantId,
        instanceId: dto.instanceId,
        projectId: dto.projectId,
        title: dto.title,
        description: dto.description,
        agents: dto.agents ?? [],
        status,
      } as any,
    });
  }

  async list(tenantId: string) {
    return this.prisma.task.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(tenantId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, tenantId },
    });

    if (!task) {
      throw new NotFoundException(`Task with id ${taskId} not found`);
    }

    return task;
  }
}
