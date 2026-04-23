import { Test, TestingModule } from '@nestjs/testing';
import { ProjectService } from './project.service';
import { PrismaService } from '@/core/database/prisma.service';

describe('ProjectService', () => {
  let service: ProjectService;
  let prisma: PrismaService;

  const mockPrismaService = {
    project: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ProjectService>(ProjectService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should call prisma.project.create with data and tenantId', async () => {
      const dto = { name: 'Test Project', description: 'desc', config: 'yaml' };
      const tenantId = 'tenant-123';
      const expectedResult = { id: 'proj-1', ...dto, tenantId };

      mockPrismaService.project.create.mockResolvedValue(expectedResult);

      const result = await service.create(dto, tenantId);

      expect(prisma.project.create).toHaveBeenCalledWith({
        data: { ...dto, tenantId },
      });
      expect(result).toEqual(expectedResult);
    });
  });

  describe('findAll', () => {
    it('should call prisma.project.findMany with tenantId filter', async () => {
      const tenantId = 'tenant-123';
      const expectedResult = [{ id: 'proj-1', name: 'Project A', tenantId }];

      mockPrismaService.project.findMany.mockResolvedValue(expectedResult);

      const result = await service.findAll(tenantId);

      expect(prisma.project.findMany).toHaveBeenCalledWith({
        where: { tenantId },
      });
      expect(result).toEqual(expectedResult);
    });
  });
});
