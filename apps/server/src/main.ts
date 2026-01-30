import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Parse CORS origins from environment variable
  // Supports comma-separated list: "http://localhost:5173,https://myapp.com"
  const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
    : '*';

  // Enable CORS with production-ready configuration
  app.enableCors({
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  const port = process.env.PORT || 3001;
  await app.listen(port);

  logger.log(`Server is running on http://localhost:${port}`);
  logger.log(`WebSocket server is ready`);
  logger.log(`CORS enabled for: ${Array.isArray(corsOrigins) ? corsOrigins.join(', ') : corsOrigins}`);
  logger.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
}
bootstrap();
