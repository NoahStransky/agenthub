import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { InstanceService } from './instance.service';
import { CreateInstanceDto } from './dto/create-instance.dto';

@UseGuards(AuthGuard('jwt'))
@Controller('instances')
export class InstanceController {
  constructor(private readonly instanceService: InstanceService) {}

  @Post()
  create(@Body() dto: CreateInstanceDto, @Req() req: Request) {
    const tenantId = (req as any).user?.tenantId;
    return this.instanceService.create(tenantId, dto);
  }

  @Get()
  list(@Req() req: Request) {
    const tenantId = (req as any).user?.tenantId;
    return this.instanceService.list(tenantId);
  }

  @Get(':id/status')
  getStatus(@Param('id') id: string, @Req() req: Request) {
    const tenantId = (req as any).user?.tenantId;
    return this.instanceService.getStatus(tenantId, id);
  }

  @Post(':id/start')
  start(@Param('id') id: string, @Req() req: Request) {
    const tenantId = (req as any).user?.tenantId;
    return this.instanceService.start(tenantId, id);
  }

  @Post(':id/stop')
  stop(@Param('id') id: string, @Req() req: Request) {
    const tenantId = (req as any).user?.tenantId;
    return this.instanceService.stop(tenantId, id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: Request) {
    const tenantId = (req as any).user?.tenantId;
    return this.instanceService.remove(tenantId, id);
  }
}
