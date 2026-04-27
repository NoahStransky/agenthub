import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AdminRoleGuard } from './guards/admin-role.guard';
import { PrismaService } from '@core/database/prisma.service';

@Module({
  controllers: [AdminController],
  providers: [AdminService, AdminRoleGuard, PrismaService],
  exports: [AdminService],
})
export class AdminModule {}
