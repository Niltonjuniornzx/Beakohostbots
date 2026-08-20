import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { AuthGuard, SessionUser } from '../auth/auth.guard';
import { BulkEnvDto, CreateEnvDto, ImportEnvDto, UpdateEnvDto } from './env.dto';
import { EnvRateLimitService } from './env-rate-limit.service';
import { EnvService } from './env.service';

@UseGuards(AuthGuard)
@Controller('bots/:id/env')
export class EnvController {
  constructor(private readonly env:EnvService,private readonly limiter:EnvRateLimitService){}
  @Get() list(@Req() req:FastifyRequest&{user:SessionUser},@Param('id')id:string){return this.env.list(req.user.sub,id)}
  @Get('detected') detected(@Req() req:FastifyRequest&{user:SessionUser},@Param('id')id:string){return this.env.detected(req.user.sub,id)}
  @Post() create(@Req() req:FastifyRequest&{user:SessionUser},@Param('id')id:string,@Body()body:CreateEnvDto){this.limiter.check(req.user.sub+':env');return this.env.create(req.user.sub,id,body)}
  @Post('bulk') bulk(@Req() req:FastifyRequest&{user:SessionUser},@Param('id')id:string,@Body()body:BulkEnvDto){this.limiter.check(req.user.sub+':env');return this.env.bulk(req.user.sub,id,body.content,body.isSecret,Boolean(body.restart))}
  @Post('import') importLegacy(@Req() req:FastifyRequest&{user:SessionUser},@Param('id')id:string,@Body()body:ImportEnvDto){this.limiter.check(req.user.sub+':env-import',5,60_000);return this.env.importLegacy(req.user.sub,id,body.confirm,Boolean(body.restart))}
  @Patch(':variableId') update(@Req() req:FastifyRequest&{user:SessionUser},@Param('id')id:string,@Param('variableId')variableId:string,@Body()body:UpdateEnvDto){this.limiter.check(req.user.sub+':env');return this.env.update(req.user.sub,id,variableId,body)}
  @Delete(':variableId') remove(@Req() req:FastifyRequest&{user:SessionUser},@Param('id')id:string,@Param('variableId')variableId:string,@Query('restart')restart?:string){this.limiter.check(req.user.sub+':env');return this.env.remove(req.user.sub,id,variableId,restart==='true')}
}
