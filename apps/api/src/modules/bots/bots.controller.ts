import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { AuthGuard, SessionUser } from '../auth/auth.guard';
import { BotActionDto, BotFileDto, BotFilePathDto, CreateBotDto, CreateEntryDto, ExtractArchiveDto, InstallDependenciesDto, RenameEntryDto } from './bots.dto';
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
  @Get(':id/files/content') content(@Req() request: FastifyRequest & { user: SessionUser }, @Param('id') id: string, @Query('path') path: string) { return this.bots.fileContent(request.user.sub,id,path); }
  @Get(':id/files/download') download(@Req() request: FastifyRequest & { user: SessionUser }, @Param('id') id: string, @Query('path') path: string) { return this.bots.downloadFile(request.user.sub,id,path); }
  @Post(':id/files/create') createEntry(@Req() request: FastifyRequest & { user: SessionUser }, @Param('id') id: string, @Body() input: CreateEntryDto) { return this.bots.createEntry(request.user.sub,id,input); }
  @Post(':id/files/rename') renameEntry(@Req() request: FastifyRequest & { user: SessionUser }, @Param('id') id: string, @Body() input: RenameEntryDto) { return this.bots.renameEntry(request.user.sub,id,input); }
  @Post(':id/files/extract') extract(@Req() request: FastifyRequest & { user: SessionUser }, @Param('id') id: string, @Body() input: ExtractArchiveDto) { return this.bots.extractArchive(request.user.sub,id,input); }
  @Post(':id/actions') action(@Req() request: FastifyRequest & { user: SessionUser }, @Param('id') id: string, @Body() input: BotActionDto) { return this.bots.action(request.user.sub,id,input.action); }
  @Get(':id/jobs') jobs(@Req() request: FastifyRequest & { user: SessionUser }, @Param('id') id: string) { return this.bots.jobs(request.user.sub,id); }
  @Get(':id/dependencies') dependencies(@Req() request: FastifyRequest & { user: SessionUser }, @Param('id') id: string) { return this.bots.dependencies(request.user.sub,id); }
  @Post(':id/dependencies/install') installDependencies(@Req() request: FastifyRequest & { user: SessionUser }, @Param('id') id: string, @Body() input: InstallDependenciesDto) { return this.bots.installDependencies(request.user.sub,id,input.packages); }
  @Get(':id/logs') logs(@Req() request: FastifyRequest & { user: SessionUser }, @Param('id') id: string) { return this.bots.logs(request.user.sub,id); }
}
