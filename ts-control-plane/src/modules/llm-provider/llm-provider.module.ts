import { Module } from '@nestjs/common';
import { LlmProviderController } from './llm-provider.controller';
import { LlmProviderService } from './llm-provider.service';

@Module({
  controllers: [LlmProviderController],
  providers: [LlmProviderService],
  exports: [LlmProviderService],
})
export class LlmProviderModule {}
