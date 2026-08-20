import { Module } from '@nestjs/common';import{AuthGuard}from'../auth/auth.guard';import{AdminController}from'./admin.controller';import{AdminGuard}from'./admin.guard';import{AdminService}from'./admin.service';
@Module({controllers:[AdminController],providers:[AdminService,AuthGuard,AdminGuard]})export class AdminModule{}
