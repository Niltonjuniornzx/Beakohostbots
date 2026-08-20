import { Controller, Get, Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { BotsModule } from './bots/bots.module';
import { AdminModule } from './admin/admin.module';
import { AgentsModule } from './agents/agents.module';

@Controller('health')
class HealthController {
  @Get() check() {
    return { status: 'ok', service: 'beakohost-api', timestamp: new Date().toISOString() };
  }
}

@Module({ imports: [PrismaModule, AuthModule, BotsModule, AdminModule, AgentsModule], controllers: [HealthController] })
export class AppModule {}
