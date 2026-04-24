import { Injectable } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { RedisService } from '@core/redis/redis.service';
import Redis from 'ioredis';

export interface UsageStats {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

const PLAN_QUOTAS: Record<string, number> = {
  free: 10000,
  pro: 100000,
  enterprise: 1000000,
};

@Injectable()
export class BillingService {
  private redis: Redis;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {
    this.redis = this.redisService.getClient();
  }

  private getUsageKey(tenantId: string): string {
    const date = new Date().toISOString().split('T')[0];
    return `agenthub:usage:${tenantId}:${date}`;
  }

  private getQuota(tier: string): number {
    return PLAN_QUOTAS[tier] ?? PLAN_QUOTAS.free;
  }

  async checkQuota(tenantId: string, requestedTokens: number): Promise<boolean> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant || !tenant.isActive) {
      return false;
    }

    const quota = this.getQuota(tenant.tier);
    const key = this.getUsageKey(tenantId);
    const totalUsageStr = await this.redis.hget(key, 'totalTokens');
    const totalUsage = totalUsageStr ? parseInt(totalUsageStr, 10) : 0;

    return totalUsage + requestedTokens <= quota;
  }

  async recordUsage(
    tenantId: string,
    usage: { promptTokens: number; completionTokens: number; totalTokens: number },
  ): Promise<void> {
    const key = this.getUsageKey(tenantId);
    const pipeline = this.redis.pipeline();
    pipeline.hincrby(key, 'promptTokens', usage.promptTokens);
    pipeline.hincrby(key, 'completionTokens', usage.completionTokens);
    pipeline.hincrby(key, 'totalTokens', usage.totalTokens);
    pipeline.expire(key, 60 * 60 * 24 * 7); // 7 days TTL
    await pipeline.exec();
  }

  async getUsage(tenantId: string): Promise<UsageStats> {
    const key = this.getUsageKey(tenantId);
    const result = await this.redis.hgetall(key);

    return {
      promptTokens: parseInt(result.promptTokens || '0', 10),
      completionTokens: parseInt(result.completionTokens || '0', 10),
      totalTokens: parseInt(result.totalTokens || '0', 10),
    };
  }
}
