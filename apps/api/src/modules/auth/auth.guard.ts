import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { FastifyRequest } from 'fastify';

export type SessionUser = { sub: string; email: string; role: 'USER' | 'ADMIN' };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<FastifyRequest & { user?: SessionUser }>();
    const token = request.cookies?.beako_session;
    if (!token) throw new UnauthorizedException('Sessão necessária');
    try {
      request.user = await this.jwt.verifyAsync<SessionUser>(token);
      return true;
    } catch {
      throw new UnauthorizedException('Sessão inválida ou expirada');
    }
  }
}
