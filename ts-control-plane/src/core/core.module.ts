import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { AuthCoreModule } from './auth/auth.module';

@Global()
@Module({
  imports: [ConfigModule, DatabaseModule, RedisModule, AuthCoreModule],
  exports: [DatabaseModule, RedisModule, AuthCoreModule],
})
export class CoreModule {}
