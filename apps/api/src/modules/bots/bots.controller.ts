import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { AuthGuard, SessionUser } from '../auth/auth.guard';
import { BotActionDto, BotFileDto, BotFilePathDto, CreateBotDto } from './bots.dto';
import { BotsService } from './bots.service';

@UseGuards(AuthGuard)
@Controller('bots')
export class BotsController {
  constructor(private readonly bots: BotsService) {}
  @Get() list(@Req() request: FastifyRequest & { user: SessionUser }) { return this.bots.list(request.user.sub); }
  @Get(':id') get(@Req() request: FastifyRequest & { user: SessionUser }, @Param('id') id: string) { return this.bots.get(request.user.sub, id); }
  @Post() create(@Req() request: FastifyRequest & { user: SessionUser }, @Body() input: CreateBotDto) { return this.bots.create(request.user.sub, input); }
  @Get(':id/files') files(@Req() request: FastifyRequest & { user: SessionUser }, @Param('id') id: string) { return this.bots.files(request.user.sub, id); }
  @Post(':id/files') upload(@Req() request: FastifyRequest & { user: SessionUser }, @Param('id') id: string, @Body() input: BotFileDto) { return this.bots.uploadFile(request.user.sub, id, input); }
  @Post(':id/files/delete') removeFile(@Req() request: FastifyRequest & { user: SessionUser }, @Param('id') id: string, @Body() input: BotFilePathDto) { return this.bots.removeFile(request.user.sub, id, input.path); }
  @Post(':id/actions') action(@Req() request: FastifyRequest & { user: SessionUser }, @Param('id') id: string, @Body() input: BotActionDto) { return this.bots.action(request.user.sub,id,input.action); }
  @Get(':id/jobs') jobs(@Req() request: FastifyRequest & { user: SessionUser }, @Param('id') id: string) { return this.bots.jobs(request.user.sub,id); }
}
