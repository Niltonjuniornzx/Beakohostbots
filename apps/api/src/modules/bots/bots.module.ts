import { Module } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { BotsController } from './bots.controller';
import { BotsService } from './bots.service';

@Module({ controllers: [BotsController], providers: [BotsService, AuthGuard] })
export class BotsModule {}
