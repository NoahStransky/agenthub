import { Module } from '@nestjs/common';
import { InstanceService } from './instance.service';
import { InstanceController } from './instance.controller';
import { InstanceGatewayController } from './instance-gateway.controller';
import { HermesProxyService } from './hermes-proxy.service';
import { RUNTIME_PROVIDER } from '@core/runtime/runtime.provider';
import { InMemoryRuntimeProvider } from '@core/runtime/in-memory-runtime.provider';
import { DockerRuntimeProvider } from '@core/runtime/docker-runtime.provider';
import { WorkspaceStorageProvider } from '@core/workspace/workspace-storage.provider';

@Module({
  providers: [
    InstanceService,
    HermesProxyService,
    InMemoryRuntimeProvider,
    DockerRuntimeProvider,
    WorkspaceStorageProvider,
    {
      provide: RUNTIME_PROVIDER,
      useFactory: (memory: InMemoryRuntimeProvider, docker: DockerRuntimeProvider) => (
        process.env.RUNTIME_PROVIDER === 'docker' ? docker : memory
      ),
      inject: [InMemoryRuntimeProvider, DockerRuntimeProvider],
    },
  ],
  controllers: [InstanceController, InstanceGatewayController],
})
export class InstanceModule {}
