interface NestApplication {
  setGlobalPrefix(prefix: string): void;
  enableCors(options: Record<string, unknown>): void;
  use(middleware: unknown): void;
  init(): Promise<unknown>;
  listen(port: number, host: string): Promise<unknown>;
  getHttpAdapter(): { getInstance(): (req: unknown, res: unknown) => unknown };
}

let cachedApp: NestApplication | undefined;

export async function bootstrapServer(): Promise<NestApplication> {
  if (!cachedApp) {
    await import('reflect-metadata');
    const [{ NestFactory }, { AppModule }, { createApiGuard }] = await Promise.all([
      import('@nestjs/core'),
      import('./app.module.js'),
      import('./api-guard.js'),
    ]);
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
    cachedApp = app as unknown as NestApplication;
  }
  return cachedApp;
}

// Exportación por defecto requerida por Vercel Serverless Functions
export default async function handler(req: any, res: any) {
  try {
    const app = await bootstrapServer();
    const instance = app.getHttpAdapter().getInstance();
    if (req.url && !req.url.startsWith('/api') && req.url.startsWith('/v1')) {
      req.url = '/api' + req.url;
    }
    return instance(req, res);
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Error desconocido al iniciar NestJS.';
    console.error(JSON.stringify({ event: 'api_bootstrap_failed', detail }));
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ error: 'API_BOOTSTRAP_FAILED', detail }));
  }
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

