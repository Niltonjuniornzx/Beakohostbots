import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { AuthGuard, SessionUser } from '../auth/auth.guard';
import { CreateBotDto } from './bots.dto';
import { BotsService } from './bots.service';

@UseGuards(AuthGuard)
@Controller('bots')
export class BotsController {
  constructor(private readonly bots: BotsService) {}
  @Get() list(@Req() request: FastifyRequest & { user: SessionUser }) { return this.bots.list(request.user.sub); }
  @Get(':id') get(@Req() request: FastifyRequest & { user: SessionUser }, @Param('id') id: string) { return this.bots.get(request.user.sub, id); }
  @Post() create(@Req() request: FastifyRequest & { user: SessionUser }, @Body() input: CreateBotDto) { return this.bots.create(request.user.sub, input); }
}
