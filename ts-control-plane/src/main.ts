import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({ origin: process.env.CORS_ORIGINS?.split(',') || '*' });
  await app.listen(process.env.PORT || 3000);
  console.log(`Control Plane running on ${await app.getUrl()}`);
}
bootstrap();
