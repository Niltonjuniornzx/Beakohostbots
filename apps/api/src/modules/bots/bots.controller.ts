import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { AuthGuard, SessionUser } from '../auth/auth.guard';
import { BotActionDto, BotFileDto, BotFilePathDto, BotFilesBatchDto, CreateBotDto, CreateEntryDto, DeleteEntriesDto, ExtractArchiveDto, InstallDependenciesDto, MoveEntriesDto, RenameEntryDto, UpdateBotLimitsDto, UpdateStartupDto } from './bots.dto';
import { BotsService } from './bots.service';

@UseGuards(AuthGuard)
@Controller('bots')
export class BotsController {
  constructor(private readonly bots: BotsService) {}
  @Get('runtimes') runtimes() { return this.bots.availableRuntimes(); }
  @Get() list(@Req() request: FastifyRequest & { user: SessionUser }) { return this.bots.list(request.user.sub); }
  @Get(':id') get(@Req() request: FastifyRequest & { user: SessionUser }, @Param('id') id: string) { return this.bots.get(request.user.sub, id); }
  @Post() create(@Req() request: FastifyRequest & { user: SessionUser }, @Body() input: CreateBotDto) { return this.bots.create(request.user.sub, input); }
  @Delete(':id') remove(@Req() request: FastifyRequest & { user: SessionUser }, @Param('id') id: string) { return this.bots.deleteBot(request.user.sub,id); }
  @Get(':id/files') files(@Req() request: FastifyRequest & { user: SessionUser }, @Param('id') id: string) { return this.bots.files(request.user.sub, id); }
  @Post(':id/files') upload(@Req() request: FastifyRequest & { user: SessionUser }, @Param('id') id: string, @Body() input: BotFileDto) { return this.bots.uploadFile(request.user.sub, id, input); }
  @Post(':id/files/batch') uploadBatch(@Req() request: FastifyRequest & { user: SessionUser }, @Param('id') id: string, @Body() input: BotFilesBatchDto) { return this.bots.uploadFiles(request.user.sub, id, input.files); }
  @Post(':id/files/delete') removeFile(@Req() request: FastifyRequest & { user: SessionUser }, @Param('id') id: string, @Body() input: BotFilePathDto) { return this.bots.removeFile(request.user.sub, id, input.path); }
  @Get(':id/files/content') content(@Req() request: FastifyRequest & { user: SessionUser }, @Param('id') id: string, @Query('path') path: string) { return this.bots.fileContent(request.user.sub,id,path); }
  @Get(':id/files/download') download(@Req() request: FastifyRequest & { user: SessionUser }, @Param('id') id: string, @Query('path') path: string) { return this.bots.downloadFile(request.user.sub,id,path); }
  @Post(':id/files/create') createEntry(@Req() request: FastifyRequest & { user: SessionUser }, @Param('id') id: string, @Body() input: CreateEntryDto) { return this.bots.createEntry(request.user.sub,id,input); }
  @Post(':id/files/rename') renameEntry(@Req() request: FastifyRequest & { user: SessionUser }, @Param('id') id: string, @Body() input: RenameEntryDto) { return this.bots.renameEntry(request.user.sub,id,input); }
  @Post(':id/files/move') moveEntries(@Req() request: FastifyRequest & { user: SessionUser }, @Param('id') id: string, @Body() input: MoveEntriesDto) { return this.bots.moveEntries(request.user.sub,id,input); }
  @Post(':id/files/delete-many') deleteEntries(@Req() request: FastifyRequest & { user: SessionUser }, @Param('id') id: string, @Body() input: DeleteEntriesDto) { return this.bots.deleteEntries(request.user.sub,id,input); }
  @Post(':id/files/extract') extract(@Req() request: FastifyRequest & { user: SessionUser }, @Param('id') id: string, @Body() input: ExtractArchiveDto) { return this.bots.extractArchive(request.user.sub,id,input); }
  @Post(':id/actions') action(@Req() request: FastifyRequest & { user: SessionUser }, @Param('id') id: string, @Body() input: BotActionDto) { return this.bots.action(request.user.sub,id,input.action); }
  @Post(':id/deploy') deploy(@Req() request: FastifyRequest & { user: SessionUser }, @Param('id') id: string) { return this.bots.autoDeploy(request.user.sub,id); }
  @Patch(':id/limits') limits(@Req() request: FastifyRequest & { user: SessionUser }, @Param('id') id: string, @Body() input: UpdateBotLimitsDto) { return this.bots.updateLimits(request.user.sub,id,input); }
  @Patch(':id/startup') startup(@Req() request: FastifyRequest & { user: SessionUser }, @Param('id') id: string, @Body() input: UpdateStartupDto) { return this.bots.updateStartup(request.user.sub,id,input); }
  @Get(':id/jobs') jobs(@Req() request: FastifyRequest & { user: SessionUser }, @Param('id') id: string) { return this.bots.jobs(request.user.sub,id); }
  @Get(':id/dependencies') dependencies(@Req() request: FastifyRequest & { user: SessionUser }, @Param('id') id: string) { return this.bots.dependencies(request.user.sub,id); }
  @Post(':id/dependencies/install') installDependencies(@Req() request: FastifyRequest & { user: SessionUser }, @Param('id') id: string, @Body() input: InstallDependenciesDto) { return this.bots.installDependencies(request.user.sub,id,input.packages); }
  @Get(':id/logs') logs(@Req() request: FastifyRequest & { user: SessionUser }, @Param('id') id: string) { return this.bots.logs(request.user.sub,id); }
}
