import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService {
  private client: Redis;

  constructor(private config: ConfigService) {
    const redisUrl = config.get<string>('REDIS_URL') || 'redis://localhost:6379/0';
    this.client = new Redis(redisUrl);
  }

  getClient(): Redis {
    return this.client;
  }
}
