import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';

@Module({
  imports: [JwtModule.register({ global: true, secret: process.env.JWT_SECRET, signOptions: { expiresIn: '7d', issuer: 'beakohost' } })],
  controllers: [AuthController], providers: [AuthService, AuthGuard],
})
export class AuthModule {}
