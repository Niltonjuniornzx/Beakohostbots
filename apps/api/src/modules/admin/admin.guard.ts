import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { SessionUser } from '../auth/auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<FastifyRequest & { user?: SessionUser }>();
    const user = request.user && await this.prisma.user.findUnique({ where: { id: request.user.sub }, select: { role: true, status: true } });
    if (user?.role !== 'ADMIN' || user.status !== 'ACTIVE') throw new ForbiddenException('Acesso exclusivo para administradores');
    return true;
  }
}
