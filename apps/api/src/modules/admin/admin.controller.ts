import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { AuthGuard, SessionUser } from '../auth/auth.guard';
import { AdminGuard } from './admin.guard';
import { CreateNodeDto, MoveBotDto, UpdateNodeDto, UpdateUserDto, UserLimitsDto } from './admin.dto';
import { AdminService } from './admin.service';

@UseGuards(AuthGuard,AdminGuard) @Controller('admin')
export class AdminController{constructor(private readonly admin:AdminService){}
@Get('overview')overview(){return this.admin.overview()} @Get('users')users(){return this.admin.users()}
@Patch('users/:id')updateUser(@Req()req:FastifyRequest&{user:SessionUser},@Param('id')id:string,@Body()body:UpdateUserDto){return this.admin.updateUser(req.user.sub,id,body)}
@Get('users/:id')userDetail(@Param('id')id:string){return this.admin.userDetail(id)}
@Patch('users/:id/limits')saveLimits(@Param('id')id:string,@Body()body:UserLimitsDto){return this.admin.saveUserLimits(id,body)}
@Get('nodes')nodes(){return this.admin.nodes()} @Post('nodes')createNode(@Body()body:CreateNodeDto){return this.admin.createNode(body)}
@Patch('nodes/:id')updateNode(@Param('id')id:string,@Body()body:UpdateNodeDto){return this.admin.updateNode(id,body)}
@Delete('nodes/:id')deleteNode(@Param('id')id:string){return this.admin.deleteNode(id)}
@Get('bots')bots(){return this.admin.bots()} @Patch('bots/:id/node')moveBot(@Param('id')id:string,@Body()body:MoveBotDto){return this.admin.moveBot(id,body)} }
