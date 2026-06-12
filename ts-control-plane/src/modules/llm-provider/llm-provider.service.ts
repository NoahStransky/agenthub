import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { CreateLlmProviderDto } from './dto/create-llm-provider.dto';

export interface ProviderView {
  id: string;
  tenantId?: string | null;
  name: string;
  provider: string;
  baseUrl: string;
  apiKeyMasked: string;
  isDefault: boolean;
  isActive: boolean;
}

export interface ProviderConnectionResult {
  ok: boolean;
  status: number;
  latencyMs: number;
  provider: string;
  baseUrl: string;
  modelCount?: number;
  message?: string;
}

@Injectable()
export class LlmProviderService {
  constructor(private readonly prisma: PrismaService) {}

  maskApiKey(apiKey: string): string {
    if (!apiKey) {
      return '';
    }

    if (apiKey.length <= 8) {
      return `${apiKey.slice(0, 2)}****`;
    }

    return `${apiKey.slice(0, 4)}****${apiKey.slice(-4)}`;
  }

  assertSafeBaseUrl(baseUrl: string): void {
    let parsed: URL;

    try {
      parsed = new URL(baseUrl);
    } catch {
      throw new BadRequestException('Invalid provider baseUrl');
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new BadRequestException('Provider baseUrl must use HTTP or HTTPS');
    }

    const hostname = parsed.hostname.toLowerCase();
    const blockedHosts = new Set(['localhost', 'metadata.google.internal']);

    if (
      blockedHosts.has(hostname) ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.cluster.local') ||
      hostname === '0.0.0.0' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname.startsWith('127.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('169.254.')
    ) {
      throw new BadRequestException('Provider baseUrl is not allowed');
    }
  }

  async resolveProvider(tenantId: string, providerId?: string): Promise<ProviderView> {
    const where = providerId
      ? {
          id: providerId,
          isActive: true,
          OR: [{ tenantId }, { tenantId: null }],
        }
      : {
          isDefault: true,
          isActive: true,
          OR: [{ tenantId }, { tenantId: null }],
        };

    const providers = await (this.prisma as any).llmProviderConfig.findMany({
      where,
      orderBy: [{ tenantId: 'desc' }, { updatedAt: 'desc' }],
    });

    const provider = providers.find((candidate) => candidate.tenantId === tenantId) ?? providers[0];

    if (!provider) {
      throw new NotFoundException('No active LLM provider configured');
    }

    return {
      id: provider.id,
      tenantId: provider.tenantId,
      name: provider.name,
      provider: provider.provider,
      baseUrl: provider.baseUrl,
      apiKeyMasked: this.maskApiKey(provider.apiKeyEnc),
      isDefault: provider.isDefault,
      isActive: provider.isActive,
    };
  }

  async listTenantProviders(tenantId: string): Promise<ProviderView[]> {
    const providers = await (this.prisma as any).llmProviderConfig.findMany({
      where: {
        OR: [{ tenantId }, { tenantId: null }],
        isActive: true,
      },
      orderBy: [{ tenantId: 'desc' }, { isDefault: 'desc' }, { updatedAt: 'desc' }],
    });

    return providers.map((provider) => this.toView(provider));
  }

  async createTenantProvider(tenantId: string, dto: CreateLlmProviderDto): Promise<ProviderView> {
    this.assertSafeBaseUrl(dto.baseUrl);

    if (dto.isDefault) {
      await (this.prisma as any).llmProviderConfig.updateMany({
        where: { tenantId },
        data: { isDefault: false },
      });
    }

    const provider = await (this.prisma as any).llmProviderConfig.create({
      data: {
        tenantId,
        name: dto.name,
        provider: dto.provider,
        baseUrl: dto.baseUrl,
        apiKeyEnc: this.encodeApiKey(dto.apiKey),
        isDefault: dto.isDefault ?? false,
        isActive: true,
      },
    });

    return this.toView(provider);
  }

  async setDefaultProvider(tenantId: string, providerId: string): Promise<ProviderView> {
    const provider = await (this.prisma as any).llmProviderConfig.findFirst({
      where: { id: providerId, tenantId, isActive: true },
    });

    if (!provider) {
      throw new NotFoundException(`Provider with id ${providerId} not found`);
    }

    await (this.prisma as any).llmProviderConfig.updateMany({
      where: { tenantId },
      data: { isDefault: false },
    });

    const updated = await (this.prisma as any).llmProviderConfig.update({
      where: { id: providerId },
      data: { isDefault: true },
    });

    return this.toView(updated);
  }

  async testProviderConnection(tenantId: string, dto: CreateLlmProviderDto): Promise<ProviderConnectionResult> {
    void tenantId;
    this.assertSafeBaseUrl(dto.baseUrl);
    return this.requestProviderModels({
      provider: dto.provider,
      baseUrl: dto.baseUrl,
      apiKey: dto.apiKey,
    });
  }

  async testExistingProviderConnection(tenantId: string, providerId: string): Promise<ProviderConnectionResult> {
    const provider = await (this.prisma as any).llmProviderConfig.findFirst({
      where: { id: providerId, tenantId, isActive: true },
    });

    if (!provider) {
      throw new NotFoundException(`Provider with id ${providerId} not found`);
    }

    this.assertSafeBaseUrl(provider.baseUrl);
    return this.requestProviderModels({
      provider: provider.provider,
      baseUrl: provider.baseUrl,
      apiKey: this.decodeApiKey(provider.apiKeyEnc),
    });
  }

  private encodeApiKey(apiKey: string): string {
    return Buffer.from(apiKey, 'utf8').toString('base64');
  }

  private decodeApiKey(apiKeyEnc: string): string {
    const decoded = Buffer.from(apiKeyEnc, 'base64').toString('utf8');
    if (/^[\x20-\x7E]+$/.test(decoded) && decoded.length >= 8) {
      return decoded;
    }
    return apiKeyEnc;
  }

  private providerModelsUrl(baseUrl: string) {
    return `${baseUrl.replace(/\/$/, '')}/models`;
  }

  private async requestProviderModels(input: {
    provider: string;
    baseUrl: string;
    apiKey: string;
  }): Promise<ProviderConnectionResult> {
    const startedAt = Date.now();
    const response = await fetch(this.providerModelsUrl(input.baseUrl), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        Accept: 'application/json',
      },
    });
    const latencyMs = Date.now() - startedAt;
    let modelCount: number | undefined;
    let message: string | undefined;

    try {
      const payload = await response.json() as any;
      if (Array.isArray(payload?.data)) {
        modelCount = payload.data.length;
      }
      if (!response.ok) {
        message = payload?.error?.message || payload?.message;
      }
    } catch {
      if (!response.ok) {
        message = await response.text().catch(() => undefined);
      }
    }

    return {
      ok: response.ok,
      status: response.status,
      latencyMs,
      provider: input.provider,
      baseUrl: input.baseUrl,
      modelCount,
      message,
    };
  }

  private toView(provider: any): ProviderView {
    return {
      id: provider.id,
      tenantId: provider.tenantId,
      name: provider.name,
      provider: provider.provider,
      baseUrl: provider.baseUrl,
      apiKeyMasked: this.maskApiKey(this.decodeApiKey(provider.apiKeyEnc)),
      isDefault: provider.isDefault,
      isActive: provider.isActive,
    };
  }
}
