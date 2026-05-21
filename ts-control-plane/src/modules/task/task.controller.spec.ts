import { Test, TestingModule } from '@nestjs/testing';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';

describe('TaskController', () => {
  let controller: TaskController;

  const mockTaskService = {
    create: jest.fn(),
    list: jest.fn(),
    get: jest.fn(),
  };

  const req = { user: { tenantId: 'tenant-from-jwt' } } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TaskController],
      providers: [{ provide: TaskService, useValue: mockTaskService }],
    }).compile();

    controller = module.get<TaskController>(TaskController);
    jest.clearAllMocks();
  });

  it('should create tasks using tenantId from auth context', async () => {
    const dto = { title: 'Run task', tenantId: 'spoofed' } as any;

    await controller.create(dto, req);

    expect(mockTaskService.create).toHaveBeenCalledWith('tenant-from-jwt', dto);
  });

  it('should list tasks using tenantId from auth context', async () => {
    await controller.list(req);

    expect(mockTaskService.list).toHaveBeenCalledWith('tenant-from-jwt');
  });

  it('should get task using tenantId from auth context', async () => {
    await controller.get('task-1', req);

    expect(mockTaskService.get).toHaveBeenCalledWith('tenant-from-jwt', 'task-1');
  });
});
