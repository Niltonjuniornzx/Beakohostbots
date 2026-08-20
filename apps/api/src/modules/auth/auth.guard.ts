import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { FastifyRequest } from 'fastify';
import { PrismaService } from '../prisma/prisma.service';

export type SessionUser = { sub: string; email: string; role: 'USER' | 'ADMIN' };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly prisma: PrismaService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<FastifyRequest & { user?: SessionUser }>();
    const token = request.cookies?.beako_session;
    if (!token) throw new UnauthorizedException('Sessão necessária');
    try {
      const payload = await this.jwt.verifyAsync<SessionUser>(token);
      const current = await this.prisma.user.findUnique({ where: { id: payload.sub }, select: { email: true, role: true, status: true } });
      if (!current || current.status !== 'ACTIVE') throw new Error('inactive');
      request.user = { sub: payload.sub, email: current.email, role: current.role };
      return true;
    } catch {
      throw new UnauthorizedException('Sessão inválida ou expirada');
    }
  }
}
