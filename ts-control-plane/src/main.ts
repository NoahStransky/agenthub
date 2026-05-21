import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { AuthService } from './modules/auth/auth.service';

const BETTER_AUTH_PATH_PREFIXES = [
  '/sign-in',
  '/sign-up',
  '/sign-out',
  '/get-session',
  '/organization',
  '/admin',
  '/callback',
  '/oauth2',
  '/forget-password',
  '/reset-password',
  '/verify-email',
  '/change-email',
  '/list-sessions',
  '/delete-user',
  '/update-user',
  '/link-social',
  '/unlink-account',
  '/account-info',
  '/refresh-token',
];

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const authService = app.get(AuthService);

  app.use((req, res, next) => {
    if (
      req.path.startsWith('/auth')
      && BETTER_AUTH_PATH_PREFIXES.some((path) => req.path.startsWith(`/auth${path}`))
    ) {
      authService.handleBetterAuth(req, res).catch(next);
      return;
    }

    next();
  });
  app.use(json());
  app.use(urlencoded({ extended: true }));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const corsOrigins = process.env.CORS_ORIGINS?.split(',') || true;
  app.enableCors({ origin: corsOrigins, credentials: true });
  await app.listen(process.env.PORT || 3000);
  console.log(`Control Plane running on ${await app.getUrl()}`);
}
bootstrap();
