import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { setSessionCookie } from './auth.cookie';
import { LoginDto, RegisterDto } from './auth.dto';
import { AuthGuard, SessionUser } from './auth.guard';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Get('setup-status') status() { return this.auth.setupStatus(); }
  @Post('setup') async setup(@Body() input: RegisterDto, @Res({ passthrough: true }) reply: FastifyReply) {
    const result = await this.auth.createFirstAdmin(input); setSessionCookie(reply, result.token); return { user: result.user };
  }
  @Post('register') async register(@Body() input: RegisterDto, @Res({ passthrough: true }) reply: FastifyReply) {
    const result = await this.auth.register(input); setSessionCookie(reply, result.token); return { user: result.user };
  }
  @Post('login') async login(@Body() input: LoginDto, @Res({ passthrough: true }) reply: FastifyReply) {
    const result = await this.auth.login(input); setSessionCookie(reply, result.token); return { user: result.user };
  }
  @UseGuards(AuthGuard) @Get('me') me(@Req() request: FastifyRequest & { user: SessionUser }) { return this.auth.me(request.user.sub); }
  @Post('logout') logout(@Res({ passthrough: true }) reply: FastifyReply) { reply.clearCookie('beako_session', { path: '/' }); return { success: true }; }
}
