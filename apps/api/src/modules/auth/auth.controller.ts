import { Body, Controller, Get, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { setSessionCookie } from './auth.cookie';
import { LoginDto, RegisterDto } from './auth.dto';
import { AuthGuard, SessionUser } from './auth.guard';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Get('setup-status') status() { return this.auth.setupStatus(); }
  @Post('setup') async setup(@Body() input: RegisterDto, @Res({ passthrough: true }) reply: FastifyReply) {
    const result = await this.auth.createFirstAdmin(input); setSessionCookie(reply, result.token); return { user: result.user };
  }
  @Post('register') async register(@Body() input: RegisterDto, @Res({ passthrough: true }) reply: FastifyReply) {
    const result = await this.auth.register(input); setSessionCookie(reply, result.token); return { user: result.user };
  }
  @Post('login') async login(@Body() input: LoginDto, @Res({ passthrough: true }) reply: FastifyReply) {
    const result = await this.auth.login(input); setSessionCookie(reply, result.token); return { user: result.user };
  }
  @Get('discord/status') async discordStatus(){return{enabled:await this.auth.discordEnabled()}}
  @Get('discord') async discord(@Res() reply:FastifyReply){
    const result=await this.auth.discordAuthorizationUrl();
    reply.setCookie('beako_discord_state',result.state,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:600});
    return reply.code(302).header('Location',result.url).send();
  }
  @Get('discord/callback') async discordCallback(@Query('code')code:string,@Query('state')state:string,@Req()request:FastifyRequest,@Res()reply:FastifyReply){
    try{
      const result=await this.auth.discordCallback(code,state,request.cookies?.beako_discord_state);
      setSessionCookie(reply,result.token);
      reply.clearCookie('beako_discord_state',{path:'/'});
      return reply.code(302).header('Location',process.env.WEB_URL||'/').send();
    }catch(error:any){
      const location=`${process.env.WEB_URL||''}/login?oauth_error=${encodeURIComponent(error?.message||'Falha no login com Discord')}`;
      return reply.code(302).header('Location',location).send();
    }
  }
  @UseGuards(AuthGuard) @Get('me') me(@Req() request: FastifyRequest & { user: SessionUser }) { return this.auth.me(request.user.sub); }
  @UseGuards(AuthGuard) @Get('me/limits') limits(@Req() request: FastifyRequest & { user: SessionUser }) { return this.auth.limits(request.user.sub); }
  @Post('logout') logout(@Res({ passthrough: true }) reply: FastifyReply) { reply.clearCookie('beako_session', { path: '/' }); return { success: true }; }
}
