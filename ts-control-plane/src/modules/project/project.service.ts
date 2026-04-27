import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/core/database/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';

@Injectable()
export class ProjectService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateProjectDto, tenantId: string) {
    return this.prisma.project.create({
      data: { ...data, tenantId },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.project.findMany({
      where: { tenantId },
    });
  }
}
