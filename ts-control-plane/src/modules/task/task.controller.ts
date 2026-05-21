import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { CreateTaskDto } from './dto/create-task.dto';
import { TaskService } from './task.service';

@UseGuards(AuthGuard('jwt'))
@Controller('tasks')
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Post()
  create(@Body() dto: CreateTaskDto, @Req() req: Request) {
    const tenantId = (req as any).user?.tenantId;
    return this.taskService.create(tenantId, dto);
  }

  @Get()
  list(@Req() req: Request) {
    const tenantId = (req as any).user?.tenantId;
    return this.taskService.list(tenantId);
  }

  @Get(':id')
  get(@Param('id') id: string, @Req() req: Request) {
    const tenantId = (req as any).user?.tenantId;
    return this.taskService.get(tenantId, id);
  }
}
