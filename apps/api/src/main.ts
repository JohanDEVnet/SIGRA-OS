import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { createApiGuard } from './api-guard.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',').map((origin) => origin.trim()).filter(Boolean);
  app.enableCors({ origin: origins, methods: ['GET', 'OPTIONS'], allowedHeaders:['Content-Type','X-API-Key'], exposedHeaders:['X-Request-ID','RateLimit-Remaining','Retry-After'], credentials: false });
  app.use(createApiGuard({apiKey:process.env.API_KEY,log:entry=>console.log(JSON.stringify(entry))}));
  const port = Number(process.env.PORT ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT debe ser un entero entre 1 y 65535.');
  await app.listen(port, process.env.HOST?.trim() || (process.env.VERCEL ? '0.0.0.0' : '127.0.0.1'));
}

bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
