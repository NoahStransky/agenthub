import { Controller, Get, Post, Body, Req } from '@nestjs/common';
import { Request } from 'express';
import { ProjectService } from './project.service';
import { CreateProjectDto } from './dto/create-project.dto';

@Controller('projects')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Post()
  async create(@Body() dto: CreateProjectDto, @Req() req: Request) {
    const tenantId = (req as any).user?.tenantId;
    return this.projectService.create(dto, tenantId);
  }

  @Get()
  async findAll(@Req() req: Request) {
    const tenantId = (req as any).user?.tenantId;
    return this.projectService.findAll(tenantId);
  }
}
