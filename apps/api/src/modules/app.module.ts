import { Controller, Get, Module } from '@nestjs/common';

@Controller('health')
class HealthController {
  @Get() check() {
    return { status: 'ok', service: 'beakohost-api', timestamp: new Date().toISOString() };
  }
}

@Controller('architecture')
class ArchitectureController {
  @Get() info() {
    return {
      controlPlane: ['web', 'api', 'postgres', 'redis'],
      executionPlane: ['runner-agent', 'docker-rootless', 'bot-containers'],
      rootPasswordStored: false,
      nodeTransport: 'mTLS',
    };
  }
}

@Module({ controllers: [HealthController, ArchitectureController] })
export class AppModule {}
