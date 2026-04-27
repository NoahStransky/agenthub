import { Injectable } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { BillingService } from '@modules/billing/billing.service';

const PLAN_QUOTAS: Record<string, number> = {
  free: 10000,
  pro: 100000,
  enterprise: 1000000,
};

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billingService: BillingService,
  ) {}

  async getStats(tenantId: string) {
    const [instances, tasks, projects, usage] = await Promise.all([
      this.prisma.instance.count({ where: { tenantId } }),
      this.prisma.task.count({ where: { tenantId } }),
      this.prisma.project.count({ where: { tenantId } }),
      this.billingService.getUsage(tenantId),
    ]);

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { tier: true },
    });

    const quota = tenant ? (PLAN_QUOTAS[tenant.tier] ?? PLAN_QUOTAS.free) : PLAN_QUOTAS.free;

    return {
      instances,
      tasks,
      projects,
      usage,
      quota,
    };
  }

  async getMe(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      return null;
    }

    const { password, ...result } = tenant;
    return result;
  }

  async getProvider() {
    const providers = [
      {
        id: 'openai',
        name: 'OpenAI',
        models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
      },
      {
        id: 'anthropic',
        name: 'Anthropic',
        models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
      },
      {
        id: 'google',
        name: 'Google',
        models: ['gemini-1.5-pro', 'gemini-1.5-flash'],
      },
      {
        id: 'deepseek',
        name: 'DeepSeek',
        models: ['deepseek-chat', 'deepseek-coder'],
      },
    ];

    return { providers };
  }
}
