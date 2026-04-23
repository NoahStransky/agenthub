import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CoreModule } from './core/core.module';
import { AuthModule } from './modules/auth/auth.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { InstanceModule } from './modules/instance/instance.module';
import { TaskModule } from './modules/task/task.module';
import { BillingModule } from './modules/billing/billing.module';
import { EventsModule } from './modules/events/events.module';
import { ProjectModule } from './modules/project/project.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CoreModule,
    AuthModule,
    TenantModule,
    InstanceModule,
    TaskModule,
    BillingModule,
    EventsModule,
    ProjectModule,
  ],
})
export class AppModule {}
