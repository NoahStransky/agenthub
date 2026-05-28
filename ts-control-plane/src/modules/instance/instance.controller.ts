import { All, Body, Controller, Delete, Get, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { InstanceService } from './instance.service';
import { CreateInstanceDto } from './dto/create-instance.dto';
import { HermesProxyService } from './hermes-proxy.service';

@UseGuards(AuthGuard('jwt'))
@Controller('instances')
export class InstanceController {
  constructor(
    private readonly instanceService: InstanceService,
    private readonly hermesProxy: HermesProxyService,
  ) {}

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

  @All(':id/proxy')
  @All(':id/proxy/*')
  async proxy(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    const tenantId = (req as any).user?.tenantId;
    const userId = (req as any).user?.userId;
    const target = await this.instanceService.getProxyTarget(tenantId, id);
    return this.hermesProxy.forward(req, res, target, {
      tenantId,
      userId,
      targetPath: this.hermesProxy.targetPathFromMarker(req, `/instances/${id}/proxy`),
    });
  }
}
