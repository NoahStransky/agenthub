import { Module } from '@nestjs/common';
import { InstanceService } from './instance.service';
import { InstanceController } from './instance.controller';
import { RUNTIME_PROVIDER } from '@core/runtime/runtime.provider';
import { InMemoryRuntimeProvider } from '@core/runtime/in-memory-runtime.provider';

@Module({
  providers: [
    InstanceService,
    InMemoryRuntimeProvider,
    {
      provide: RUNTIME_PROVIDER,
      useExisting: InMemoryRuntimeProvider,
    },
  ],
  controllers: [InstanceController],
})
export class InstanceModule {}
