import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import { InstanceService } from './instance.service';
import { CreateInstanceDto } from './dto/create-instance.dto';

@Controller('instances')
export class InstanceController {
  constructor(private readonly instanceService: InstanceService) {}

  @Post()
  create(@Body() dto: CreateInstanceDto) {
    return this.instanceService.create(dto.tenantId, dto.tier);
  }

  @Get()
  list(@Query('tenantId') tenantId: string) {
    return this.instanceService.list(tenantId);
  }
}
