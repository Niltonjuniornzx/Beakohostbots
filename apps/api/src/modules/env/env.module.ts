import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuthGuard } from '../auth/auth.guard';
import { EnvController } from './env.controller';
import { EnvCryptoService } from './env.crypto';
import { EnvRateLimitService } from './env-rate-limit.service';
import { EnvService } from './env.service';

@Global()
@Module({imports:[AuthModule],controllers:[EnvController],providers:[EnvCryptoService,EnvRateLimitService,EnvService,AuthGuard],exports:[EnvCryptoService,EnvService]})
export class EnvModule{}
