import { Module } from '@nestjs/common';
import { InstanceService } from './instance.service';
import { InstanceController } from './instance.controller';
import { DATA_PLANE_CLIENT } from '@core/grpc/data-plane.client';

@Module({
  providers: [
    InstanceService,
    {
      provide: DATA_PLANE_CLIENT,
      useValue: {
        createInstance: async () => ({ containerId: 'mock', endpoint: 'http://mock' }),
        getInstanceStatus: async () => ({ status: 'mock', endpoint: 'http://mock' }),
      },
    },
  ],
  controllers: [InstanceController],
})
export class InstanceModule {}
