import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { DashboardService } from './dashboard.service';

@UseGuards(AuthGuard('jwt'))
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  async getStats(@Req() req: Request) {
    const tenantId = (req as any).user?.tenantId;
    return this.dashboardService.getStats(tenantId);
  }

  @Get('me')
  async getMe(@Req() req: Request) {
    const tenantId = (req as any).user?.tenantId;
    return this.dashboardService.getMe(tenantId);
  }

  @Get('provider')
  async getProvider() {
    return this.dashboardService.getProvider();
  }
}
