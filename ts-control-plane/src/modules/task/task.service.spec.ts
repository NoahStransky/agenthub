import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@core/database/prisma.service';
import { TaskService } from './task.service';

describe('TaskService', () => {
  let service: TaskService;

  const mockPrisma = {
    instance: {
      findFirst: jest.fn(),
    },
    task: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<TaskService>(TaskService);
    jest.clearAllMocks();
  });

  it('should verify instance ownership before creating a task', async () => {
    mockPrisma.instance.findFirst.mockResolvedValue({
      id: 'instance-1',
      observedStatus: 'running',
      health: 'healthy',
    });
    mockPrisma.task.create.mockResolvedValue({ id: 'task-1', status: 'pending' });

    const result = await service.create('tenant-1', {
      instanceId: 'instance-1',
      title: 'Run analysis',
    });

    expect(mockPrisma.instance.findFirst).toHaveBeenCalledWith({
      where: { id: 'instance-1', tenantId: 'tenant-1' },
    });
    expect(mockPrisma.task.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        instanceId: 'instance-1',
        title: 'Run analysis',
        status: 'pending',
      }),
    });
    expect(result).toEqual({ id: 'task-1', status: 'pending' });
  });

  it('should block task execution when instance is not running', async () => {
    mockPrisma.instance.findFirst.mockResolvedValue({
      id: 'instance-1',
      observedStatus: 'pending',
      health: 'unknown',
    });
    mockPrisma.task.create.mockResolvedValue({ id: 'task-1', status: 'queued_blocked' });

    await service.create('tenant-1', {
      instanceId: 'instance-1',
      title: 'Run analysis',
    });

    expect(mockPrisma.task.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: 'queued_blocked' }),
    });
  });

  it('should reject tasks for instances outside the tenant', async () => {
    mockPrisma.instance.findFirst.mockResolvedValue(null);

    await expect(service.create('tenant-1', {
      instanceId: 'instance-2',
      title: 'Run analysis',
    })).rejects.toThrow(NotFoundException);
  });

  it('should attach a task to the newest healthy instance when no instance is specified', async () => {
    mockPrisma.instance.findFirst.mockResolvedValue({
      id: 'instance-healthy',
      observedStatus: 'running',
      health: 'healthy',
    });
    mockPrisma.task.create.mockResolvedValue({ id: 'task-1', instanceId: 'instance-healthy', status: 'pending' });

    await service.create('tenant-1', { title: 'Run analysis' });

    expect(mockPrisma.instance.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        desiredStatus: 'running',
        observedStatus: 'running',
        health: 'healthy',
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(mockPrisma.task.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        instanceId: 'instance-healthy',
        status: 'pending',
      }),
    });
  });

  it('should mark a task queued_blocked when no healthy instance exists', async () => {
    mockPrisma.instance.findFirst.mockResolvedValue(null);
    mockPrisma.task.create.mockResolvedValue({ id: 'task-1', status: 'queued_blocked' });

    await service.create('tenant-1', { title: 'Run analysis' });

    expect(mockPrisma.task.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        instanceId: undefined,
        status: 'queued_blocked',
      }),
    });
  });
});
