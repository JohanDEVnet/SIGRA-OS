import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { createApiGuard } from './api-guard.js';
import type { INestApplication } from '@nestjs/common';

let cachedApp: INestApplication | undefined;

export async function bootstrapServer(): Promise<INestApplication> {
  if (!cachedApp) {
    const app = await NestFactory.create(AppModule);
    app.setGlobalPrefix('api/v1');
    const corsOriginsConfig = process.env.CORS_ORIGINS?.trim();
    const corsOrigin = corsOriginsConfig
      ? corsOriginsConfig.split(',').map((origin) => origin.trim()).filter(Boolean)
      : (process.env.VERCEL ? true : ['http://localhost:5173', 'http://127.0.0.1:5173']);
    app.enableCors({
      origin: corsOrigin,
      methods: ['GET', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'X-API-Key'],
      exposedHeaders: ['X-Request-ID', 'RateLimit-Remaining', 'Retry-After'],
      credentials: false,
    });
    app.use(createApiGuard({ apiKey: process.env.API_KEY, log: entry => console.log(JSON.stringify(entry)) }));
    await app.init();
    cachedApp = app;
  }
  return cachedApp;
}

// Exportación por defecto requerida por Vercel Serverless Functions
export default async function handler(req: any, res: any) {
  const app = await bootstrapServer();
  const instance = app.getHttpAdapter().getInstance();
  if (req.url && !req.url.startsWith('/api') && req.url.startsWith('/v1')) {
    req.url = '/api' + req.url;
  }
  return instance(req, res);
}

// Ejecución local (cuando no está corriendo en Vercel)
if (!process.env.VERCEL) {
  bootstrapServer().then(async (app) => {
    const rawPort = process.env.PORT?.trim();
    const port = rawPort && !Number.isNaN(Number(rawPort)) && Number(rawPort) >= 1 && Number(rawPort) <= 65535 ? Number(rawPort) : 3001;
    await app.listen(port, process.env.HOST?.trim() || '127.0.0.1');
  }).catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}

