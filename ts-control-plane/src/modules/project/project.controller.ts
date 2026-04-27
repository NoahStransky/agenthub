import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { ProjectService } from './project.service';
import { CreateProjectDto } from './dto/create-project.dto';

@UseGuards(AuthGuard('jwt'))
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
