import { All, Controller, Param, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { HermesProxyService } from './hermes-proxy.service';
import { InstanceService } from './instance.service';

@Controller('gateway/hermes')
export class InstanceGatewayController {
  constructor(
    private readonly instanceService: InstanceService,
    private readonly hermesProxy: HermesProxyService,
  ) {}

  @All(':token')
  @All(':token/*')
  async proxy(@Param('token') token: string, @Req() req: Request, @Res() res: Response) {
    const target = await this.instanceService.getGatewayTarget(token);
    return this.hermesProxy.forward(req, res, target, {
      publicGateway: true,
      targetPath: this.hermesProxy.targetPathFromMarker(req, `/gateway/hermes/${token}`),
    });
  }
}
