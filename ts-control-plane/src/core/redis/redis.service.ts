import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService {
  private client: Redis;

  constructor(private config: ConfigService) {
    this.client = new Redis(config.get('REDIS_URL') || 'redis://localhost:6379/0');
  }

  getClient(): Redis {
    return this.client;
  }
}
