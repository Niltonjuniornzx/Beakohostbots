import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { AuthGuard, SessionUser } from '../auth/auth.guard';
import { AdminGuard } from './admin.guard';
import { AssignPlanDto, CreateNodeDto, DiscordSettingsDto, MoveBotDto, SavePlanDto, UpdateNodeDto, UpdateUserDto, UserLimitsDto } from './admin.dto';
import { AdminService } from './admin.service';

@UseGuards(AuthGuard,AdminGuard) @Controller('admin')
export class AdminController{constructor(private readonly admin:AdminService){}
@Get('overview')overview(){return this.admin.overview()} @Get('users')users(){return this.admin.users()}
@Patch('users/:id')updateUser(@Req()req:FastifyRequest&{user:SessionUser},@Param('id')id:string,@Body()body:UpdateUserDto){return this.admin.updateUser(req.user.sub,id,body)}
@Get('users/:id')userDetail(@Param('id')id:string){return this.admin.userDetail(id)}
@Patch('users/:id/limits')saveLimits(@Param('id')id:string,@Body()body:UserLimitsDto){return this.admin.saveUserLimits(id,body)}
@Patch('users/:id/plan')assignPlan(@Param('id')id:string,@Body()body:AssignPlanDto){return this.admin.assignPlan(id,body)}
@Get('plans')plans(){return this.admin.plans()} @Post('plans')createPlan(@Body()body:SavePlanDto){return this.admin.savePlan(undefined,body)}
@Patch('plans/:id')updatePlan(@Param('id')id:string,@Body()body:SavePlanDto){return this.admin.savePlan(id,body)}
@Get('settings/discord')discordSettings(){return this.admin.discordSettings()} @Patch('settings/discord')saveDiscordSettings(@Body()body:DiscordSettingsDto){return this.admin.saveDiscordSettings(body)}
@Get('nodes')nodes(){return this.admin.nodes()} @Post('nodes')createNode(@Body()body:CreateNodeDto){return this.admin.createNode(body)}
@Patch('nodes/:id')updateNode(@Param('id')id:string,@Body()body:UpdateNodeDto){return this.admin.updateNode(id,body)}
@Delete('nodes/:id')deleteNode(@Param('id')id:string){return this.admin.deleteNode(id)}
@Get('bots')bots(){return this.admin.bots()} @Patch('bots/:id/node')moveBot(@Param('id')id:string,@Body()body:MoveBotDto){return this.admin.moveBot(id,body)} }
