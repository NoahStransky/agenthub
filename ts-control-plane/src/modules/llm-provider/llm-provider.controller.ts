import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { CreateLlmProviderDto } from './dto/create-llm-provider.dto';
import { LlmProviderService } from './llm-provider.service';

@UseGuards(AuthGuard('jwt'))
@Controller('llm-providers')
export class LlmProviderController {
  constructor(private readonly llmProviderService: LlmProviderService) {}

  @Get()
  list(@Req() req: Request) {
    const tenantId = (req as any).user?.tenantId;
    return this.llmProviderService.listTenantProviders(tenantId);
  }

  @Post()
  create(@Body() dto: CreateLlmProviderDto, @Req() req: Request) {
    const tenantId = (req as any).user?.tenantId;
    return this.llmProviderService.createTenantProvider(tenantId, dto);
  }

  @Post('test')
  test(@Body() dto: CreateLlmProviderDto, @Req() req: Request) {
    const tenantId = (req as any).user?.tenantId;
    return this.llmProviderService.testProviderConnection(tenantId, dto);
  }

  @Post(':id/test')
  testExisting(@Param('id') id: string, @Req() req: Request) {
    const tenantId = (req as any).user?.tenantId;
    return this.llmProviderService.testExistingProviderConnection(tenantId, id);
  }

  @Patch(':id/default')
  setDefault(@Param('id') id: string, @Req() req: Request) {
    const tenantId = (req as any).user?.tenantId;
    return this.llmProviderService.setDefaultProvider(tenantId, id);
  }
}
