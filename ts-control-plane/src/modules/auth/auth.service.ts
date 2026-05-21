import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../core/database/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { createAgentHubBetterAuth } from '@core/better-auth/better-auth.factory';

@Injectable()
export class AuthService {
  private betterAuth?: any;
  private betterAuthHandler?: (req: any, res: any) => Promise<void>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const existingUsers = await this.prisma.user.count();
    const platformRole = existingUsers === 0 ? 'super_admin' : 'user';

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        name: dto.name,
        platformRole,
        isActive: true,
      },
    });

    const tenant = await this.prisma.tenant.create({
      data: {
        name: dto.name ? `${dto.name}'s Workspace` : `${dto.email}'s Workspace`,
        slug: this.slugify(dto.name || dto.email),
        tier: 'free',
        status: 'active',
        isActive: true,
        members: {
          create: {
            userId: user.id,
            role: 'owner',
          },
        },
      },
      include: {
        members: true,
      },
    });

    const { password, ...result } = user;
    return {
      ...result,
      activeTenantId: tenant.id,
      activeTenant: tenant,
      memberRole: 'owner',
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: {
        memberships: {
          include: { tenant: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!user || !user.isActive || user.banned) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const activeMembership = user.memberships.find((membership) => membership.tenant?.isActive);
    if (!activeMembership) {
      throw new UnauthorizedException('No active organization');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      platformRole: user.platformRole,
      activeTenantId: activeMembership.tenantId,
      memberRole: activeMembership.role,
    };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async issueApiTokenFromBetterAuthRequest(req: any) {
    const auth = await this.getBetterAuth();
    const session = await auth.api.getSession({
      headers: this.toWebHeaders(req.headers),
    });

    if (!session?.user?.id) {
      throw new UnauthorizedException('Invalid session');
    }

    const membership = await this.ensureDefaultTenantMembership(session.user);
    const payload = {
      sub: session.user.id,
      email: session.user.email,
      platformRole: session.user.platformRole ?? 'user',
      activeTenantId: membership.tenantId,
      memberRole: membership.role,
    };

    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async me(userId: string, activeTenantId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          include: { tenant: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!user || !user.isActive || user.banned) {
      throw new UnauthorizedException('Invalid user');
    }

    const activeMembership = user.memberships.find((membership) => (
      membership.tenantId === activeTenantId && membership.tenant?.isActive
    )) ?? user.memberships.find((membership) => membership.tenant?.isActive);

    const { password, memberships, ...result } = user;
    return {
      user: result,
      activeTenant: activeMembership?.tenant ?? null,
      memberRole: activeMembership?.role ?? null,
      memberships: memberships.map((membership) => ({
        id: membership.id,
        role: membership.role,
        tenant: membership.tenant,
      })),
    };
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48) || `tenant-${Date.now()}`;
  }

  private async ensureDefaultTenantMembership(user: { id: string; email: string; name?: string | null }) {
    const existingMembership = await this.prisma.member.findFirst({
      where: {
        userId: user.id,
        tenant: { isActive: true },
      },
      include: { tenant: true },
      orderBy: { createdAt: 'asc' },
    });

    if (existingMembership) {
      return existingMembership;
    }

    const displayName = user.name || user.email;
    const tenant = await this.prisma.tenant.create({
      data: {
        name: `${displayName}'s Workspace`,
        slug: `${this.slugify(displayName)}-${user.id.slice(0, 8)}`,
        tier: 'free',
        status: 'active',
        isActive: true,
        members: {
          create: {
            userId: user.id,
            role: 'owner',
          },
        },
      },
      include: {
        members: true,
      },
    });

    return tenant.members[0];
  }

  private async getBetterAuth() {
    if (!this.betterAuth) {
      this.betterAuth = await createAgentHubBetterAuth(this.prisma);
    }

    return this.betterAuth;
  }

  private toWebHeaders(headers: Record<string, string | string[] | undefined>) {
    const webHeaders = new Headers();
    for (const [key, value] of Object.entries(headers || {})) {
      if (Array.isArray(value)) {
        value.forEach((item) => webHeaders.append(key, item));
      } else if (value !== undefined) {
        webHeaders.set(key, value);
      }
    }
    return webHeaders;
  }

  async handleBetterAuth(req: any, res: any) {
    if (!this.betterAuthHandler) {
      const auth = await this.getBetterAuth();
      const dynamicImport = new Function('specifier', 'return import(specifier)') as <T = any>(specifier: string) => Promise<T>;
      const { toNodeHandler } = await dynamicImport('better-auth/node');
      this.betterAuthHandler = toNodeHandler(auth);
    }

    return this.betterAuthHandler(req, res);
  }
}
