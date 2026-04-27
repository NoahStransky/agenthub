import { Test, TestingModule } from '@nestjs/testing';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import { CreateProjectDto } from './dto/create-project.dto';

describe('ProjectController', () => {
  let controller: ProjectController;
  let service: ProjectService;

  const mockProjectService = {
    create: jest.fn(),
    findAll: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectController],
      providers: [
        { provide: ProjectService, useValue: mockProjectService },
      ],
    }).compile();

    controller = module.get<ProjectController>(ProjectController);
    service = module.get<ProjectService>(ProjectService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should call service.create with dto and tenantId from request', async () => {
      const dto: CreateProjectDto = {
        name: 'Test Project',
        description: 'desc',
        config: 'yaml',
      };
      const tenantId = 'tenant-123';
      const req = { user: { tenantId } } as any;
      const expectedResult = { id: 'proj-1', ...dto, tenantId };

      mockProjectService.create.mockResolvedValue(expectedResult);

      const result = await controller.create(dto, req);

      expect(service.create).toHaveBeenCalledWith(dto, tenantId);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('findAll', () => {
    it('should call service.findAll with tenantId from request', async () => {
      const tenantId = 'tenant-123';
      const req = { user: { tenantId } } as any;
      const expectedResult = [{ id: 'proj-1', name: 'Project A', tenantId }];

      mockProjectService.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll(req);

      expect(service.findAll).toHaveBeenCalledWith(tenantId);
      expect(result).toEqual(expectedResult);
    });
  });
});
