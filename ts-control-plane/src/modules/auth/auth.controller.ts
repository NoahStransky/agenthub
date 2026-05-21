import { All, Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  async me(@Req() req: Request) {
    const userId = (req as any).user?.userId;
    const activeTenantId = (req as any).user?.tenantId;
    return this.authService.me(userId, activeTenantId);
  }

  @Post('api-token')
  async apiToken(@Req() req: Request) {
    return this.authService.issueApiTokenFromBetterAuthRequest(req);
  }

  @All('*')
  async betterAuth(@Req() req: Request, @Res() res: Response) {
    return this.authService.handleBetterAuth(req, res);
  }
}
