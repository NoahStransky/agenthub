import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { DATA_PLANE_CLIENT, IDataPlaneClient } from '@core/grpc/data-plane.client';

@Injectable()
export class InstanceService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(DATA_PLANE_CLIENT) private readonly dataPlane: IDataPlaneClient,
  ) {}

  async create(tenantId: string, tier: string) {
    const containerName = `agenthub-${tenantId}-${Date.now()}`;
    const instance = await this.prisma.instance.create({
      data: {
        tenantId,
        containerName,
        status: 'pending',
      },
    });

    const { containerId, endpoint } = await this.dataPlane.createInstance({ tenantId, tier });

    return this.prisma.instance.update({
      where: { id: instance.id },
      data: {
        containerId,
        endpoint,
        status: 'running',
      },
    });
  }

  async list(tenantId: string) {
    return this.prisma.instance.findMany({
      where: { tenantId },
    });
  }

  async getStatus(containerId: string) {
    return this.dataPlane.getInstanceStatus({ containerId });
  }
}
