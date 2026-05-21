import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@core/database/prisma.service';
import { LlmProviderService } from './llm-provider.service';

describe('LlmProviderService', () => {
  let service: LlmProviderService;

  const mockPrisma = {
    llmProviderConfig: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LlmProviderService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<LlmProviderService>(LlmProviderService);
    jest.clearAllMocks();
  });

  it('should mask API keys instead of exposing them in provider views', () => {
    expect(service.maskApiKey('sk-test-1234567890')).toBe('sk-t****7890');
  });

  it('should reject SSRF-prone provider base URLs', () => {
    const blocked = [
      'http://localhost:8080',
      'http://127.0.0.1:8080',
      'http://10.0.0.2/v1',
      'http://192.168.1.2/v1',
      'http://169.254.169.254/latest',
      'ftp://api.example.com/v1',
      'http://model-proxy.agenthub-system.svc.cluster.local',
    ];

    for (const url of blocked) {
      expect(() => service.assertSafeBaseUrl(url)).toThrow(BadRequestException);
    }
  });

  it('should allow public HTTP or HTTPS provider base URLs', () => {
    expect(() => service.assertSafeBaseUrl('https://api.openai.com/v1')).not.toThrow();
    expect(() => service.assertSafeBaseUrl('https://openrouter.ai/api/v1')).not.toThrow();
  });

  it('should prefer tenant default provider over platform default provider', async () => {
    mockPrisma.llmProviderConfig.findMany.mockResolvedValue([
      {
        id: 'tenant-provider',
        tenantId: 'tenant-1',
        name: 'Tenant OpenAI',
        provider: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKeyEnc: 'sk-tenant-123456',
        isDefault: true,
        isActive: true,
      },
      {
        id: 'platform-provider',
        tenantId: null,
        name: 'Platform OpenRouter',
        provider: 'openrouter',
        baseUrl: 'https://openrouter.ai/api/v1',
        apiKeyEnc: 'sk-platform-123456',
        isDefault: true,
        isActive: true,
      },
    ]);

    const result = await service.resolveProvider('tenant-1');

    expect(result.id).toBe('tenant-provider');
    expect(result.apiKeyMasked).toBe('sk-t****3456');
  });

  it('should fall back to platform default provider when tenant has no provider', async () => {
    mockPrisma.llmProviderConfig.findMany.mockResolvedValue([
      {
        id: 'platform-provider',
        tenantId: null,
        name: 'Platform OpenRouter',
        provider: 'openrouter',
        baseUrl: 'https://openrouter.ai/api/v1',
        apiKeyEnc: 'sk-platform-123456',
        isDefault: true,
        isActive: true,
      },
    ]);

    const result = await service.resolveProvider('tenant-1');

    expect(result.id).toBe('platform-provider');
  });

  it('should throw when no active provider exists', async () => {
    mockPrisma.llmProviderConfig.findMany.mockResolvedValue([]);

    await expect(service.resolveProvider('tenant-1')).rejects.toThrow(NotFoundException);
  });

  it('should create tenant provider without exposing the full API key', async () => {
    mockPrisma.llmProviderConfig.create.mockResolvedValue({
      id: 'provider-1',
      tenantId: 'tenant-1',
      name: 'My OpenAI',
      provider: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKeyEnc: Buffer.from('sk-secret-123456', 'utf8').toString('base64'),
      isDefault: true,
      isActive: true,
    });
    mockPrisma.llmProviderConfig.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.createTenantProvider('tenant-1', {
      name: 'My OpenAI',
      provider: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-secret-123456',
      isDefault: true,
    });

    expect(mockPrisma.llmProviderConfig.updateMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1' },
      data: { isDefault: false },
    });
    expect(mockPrisma.llmProviderConfig.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        apiKeyEnc: expect.not.stringContaining('sk-secret-123456'),
        isDefault: true,
      }),
    });
    expect(result).not.toHaveProperty('apiKey');
    expect(result.apiKeyMasked).not.toContain('sk-secret-123456');
  });

  it('should set a tenant provider as default', async () => {
    mockPrisma.llmProviderConfig.findFirst.mockResolvedValue({ id: 'provider-1' });
    mockPrisma.llmProviderConfig.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.llmProviderConfig.update.mockResolvedValue({
      id: 'provider-1',
      tenantId: 'tenant-1',
      name: 'My OpenAI',
      provider: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKeyEnc: 'sk-secret-123456',
      isDefault: true,
      isActive: true,
    });

    const result = await service.setDefaultProvider('tenant-1', 'provider-1');

    expect(mockPrisma.llmProviderConfig.findFirst).toHaveBeenCalledWith({
      where: { id: 'provider-1', tenantId: 'tenant-1', isActive: true },
    });
    expect(result.isDefault).toBe(true);
  });
});
