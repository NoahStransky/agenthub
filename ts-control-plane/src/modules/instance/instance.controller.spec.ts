import { Test, TestingModule } from '@nestjs/testing';
import { InstanceController } from './instance.controller';
import { InstanceService } from './instance.service';

describe('InstanceController', () => {
  let controller: InstanceController;
  const mockInstanceService = {
    create: jest.fn(),
    list: jest.fn(),
    getStatus: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    remove: jest.fn(),
  };

  const req = {
    user: { tenantId: 'tenant-from-jwt' },
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InstanceController],
      providers: [{ provide: InstanceService, useValue: mockInstanceService }],
    }).compile();

    controller = module.get<InstanceController>(InstanceController);
    jest.clearAllMocks();
  });

  it('should create instances using tenantId from auth context, not request body', async () => {
    const dto = {
      tenantId: 'spoofed-tenant',
      tier: 'enterprise',
      runtimeClass: 'gvisor' as const,
    } as any;
    mockInstanceService.create.mockResolvedValue({ id: 'instance-1' });

    await controller.create(dto, req);

    expect(mockInstanceService.create).toHaveBeenCalledWith('tenant-from-jwt', dto);
  });

  it('should list instances using tenantId from auth context', async () => {
    mockInstanceService.list.mockResolvedValue([]);

    await controller.list(req);

    expect(mockInstanceService.list).toHaveBeenCalledWith('tenant-from-jwt');
  });

  it('should get status using tenantId from auth context', async () => {
    mockInstanceService.getStatus.mockResolvedValue({ observedStatus: 'running' });

    await controller.getStatus('instance-1', req);

    expect(mockInstanceService.getStatus).toHaveBeenCalledWith('tenant-from-jwt', 'instance-1');
  });

  it('should start using tenantId from auth context', async () => {
    await controller.start('instance-1', req);

    expect(mockInstanceService.start).toHaveBeenCalledWith('tenant-from-jwt', 'instance-1');
  });

  it('should stop using tenantId from auth context', async () => {
    await controller.stop('instance-1', req);

    expect(mockInstanceService.stop).toHaveBeenCalledWith('tenant-from-jwt', 'instance-1');
  });

  it('should delete using tenantId from auth context', async () => {
    await controller.remove('instance-1', req);

    expect(mockInstanceService.remove).toHaveBeenCalledWith('tenant-from-jwt', 'instance-1');
  });
});
