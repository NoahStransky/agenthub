import { Test, TestingModule } from '@nestjs/testing';
import { LlmProviderController } from './llm-provider.controller';
import { LlmProviderService } from './llm-provider.service';

describe('LlmProviderController', () => {
  let controller: LlmProviderController;

  const mockService = {
    listTenantProviders: jest.fn(),
    createTenantProvider: jest.fn(),
    setDefaultProvider: jest.fn(),
    testProviderConnection: jest.fn(),
    testExistingProviderConnection: jest.fn(),
  };

  const req = { user: { tenantId: 'tenant-from-jwt' } } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LlmProviderController],
      providers: [{ provide: LlmProviderService, useValue: mockService }],
    }).compile();

    controller = module.get<LlmProviderController>(LlmProviderController);
    jest.clearAllMocks();
  });

  it('should list providers using tenantId from auth context', async () => {
    await controller.list(req);

    expect(mockService.listTenantProviders).toHaveBeenCalledWith('tenant-from-jwt');
  });

  it('should create providers using tenantId from auth context', async () => {
    const dto = {
      name: 'OpenAI',
      provider: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-test',
    };

    await controller.create(dto, req);

    expect(mockService.createTenantProvider).toHaveBeenCalledWith('tenant-from-jwt', dto);
  });

  it('should set default provider using tenantId from auth context', async () => {
    await controller.setDefault('provider-1', req);

    expect(mockService.setDefaultProvider).toHaveBeenCalledWith('tenant-from-jwt', 'provider-1');
  });

  it('should test new provider connection using tenantId from auth context', async () => {
    const dto = {
      name: 'OpenAI',
      provider: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-test',
    };

    await controller.test(dto, req);

    expect(mockService.testProviderConnection).toHaveBeenCalledWith('tenant-from-jwt', dto);
  });

  it('should test existing provider connection using tenantId from auth context', async () => {
    await controller.testExisting('provider-1', req);

    expect(mockService.testExistingProviderConnection).toHaveBeenCalledWith('tenant-from-jwt', 'provider-1');
  });
});
