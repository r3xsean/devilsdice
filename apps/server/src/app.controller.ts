import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

interface HealthCheckResponse {
  status: 'ok' | 'error';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
}

@Controller()
export class AppController {
  private readonly startTime = Date.now();

  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth(): HealthCheckResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    };
  }

  @Get('ready')
  getReadiness(): { ready: boolean } {
    // Can add additional checks here (e.g., database connectivity)
    return { ready: true };
  }
}
