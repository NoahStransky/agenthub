import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@core/database/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(email: string, password: string): Promise<{ access_token: string }> {
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
      const tenant = await this.prisma.tenant.create({
        data: { email, password: hashedPassword },
      });

      const token = this.jwtService.sign({
        sub: tenant.id,
        email: tenant.email,
      });

      return { access_token: token };
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException('Email already exists');
      }
      throw error;
    }
  }

  async login(email: string, password: string): Promise<{ access_token: string }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { email },
    });

    if (!tenant) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, tenant.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = this.jwtService.sign({
      sub: tenant.id,
      email: tenant.email,
    });

    return { access_token: token };
  }
}
