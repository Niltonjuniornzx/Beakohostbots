import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from './auth.dto';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}
  async setupStatus() { return { needsAdmin: (await this.prisma.user.count()) === 0 }; }
  async createFirstAdmin(input: RegisterDto) {
    if (await this.prisma.user.count()) throw new ConflictException('O administrador inicial já foi criado');
    return this.createUser(input, 'ADMIN');
  }
  async register(input: RegisterDto) { return this.createUser(input, 'USER'); }
  private async createUser(input: RegisterDto, role: 'USER' | 'ADMIN') {
    const email = input.email.trim().toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } })) throw new ConflictException('Este e-mail já está cadastrado');
    const user = await this.prisma.user.create({ data: { email, displayName: input.displayName.trim(), passwordHash: await hash(input.password, 12), role } });
    return this.session(user);
  }
  async login(input: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: input.email.trim().toLowerCase() } });
    if (!user?.passwordHash || user.status !== 'ACTIVE' || !(await compare(input.password, user.passwordHash))) throw new UnauthorizedException('E-mail ou senha inválidos');
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return this.session(user);
  }
  discordEnabled(){return Boolean(process.env.DISCORD_CLIENT_ID&&process.env.DISCORD_CLIENT_SECRET)}
  async discordAuthorizationUrl(){if(!this.discordEnabled())throw new BadRequestException('Login com Discord não configurado');const state=await this.jwt.signAsync({purpose:'discord-oauth'},{expiresIn:'10m'});const redirect=this.discordRedirectUri();const url=new URL('https://discord.com/oauth2/authorize');url.searchParams.set('client_id',process.env.DISCORD_CLIENT_ID!);url.searchParams.set('response_type','code');url.searchParams.set('redirect_uri',redirect);url.searchParams.set('scope','identify email');url.searchParams.set('state',state);url.searchParams.set('prompt','none');return{url:url.toString(),state}}
  async discordCallback(code:string,state:string,cookieState:string|undefined){if(!code||!state||!cookieState||state!==cookieState)throw new UnauthorizedException('Estado OAuth inválido');try{const payload=await this.jwt.verifyAsync(state);if(payload.purpose!=='discord-oauth')throw new Error()}catch{throw new UnauthorizedException('Estado OAuth expirado')};const body=new URLSearchParams({client_id:process.env.DISCORD_CLIENT_ID!,client_secret:process.env.DISCORD_CLIENT_SECRET!,grant_type:'authorization_code',code,redirect_uri:this.discordRedirectUri()});const tokenResponse=await fetch('https://discord.com/api/oauth2/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body});if(!tokenResponse.ok)throw new UnauthorizedException('Discord recusou a autorização');const token:any=await tokenResponse.json();const profileResponse=await fetch('https://discord.com/api/users/@me',{headers:{authorization:`Bearer ${token.access_token}`}});if(!profileResponse.ok)throw new UnauthorizedException('Não foi possível obter o perfil do Discord');const profile:any=await profileResponse.json();if(!profile.id||!profile.email||profile.verified===false)throw new UnauthorizedException('O Discord precisa fornecer um e-mail verificado');const email=String(profile.email).toLowerCase(),discordAvatar=profile.avatar?`https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`:null;let account=await this.prisma.oAuthAccount.findUnique({where:{provider_providerAccountId:{provider:'DISCORD',providerAccountId:String(profile.id)}},include:{user:true}});let user=account?.user;if(!user){user=await this.prisma.user.findUnique({where:{email}})||await this.prisma.user.create({data:{email,displayName:profile.global_name||profile.username||'Usuário Discord',avatarUrl:discordAvatar,emailVerifiedAt:new Date()}});await this.prisma.oAuthAccount.create({data:{provider:'DISCORD',providerAccountId:String(profile.id),userId:user.id,expiresAt:token.expires_in?new Date(Date.now()+Number(token.expires_in)*1000):null}})}if(user.status!=='ACTIVE')throw new UnauthorizedException('Conta suspensa ou bloqueada');user=await this.prisma.user.update({where:{id:user.id},data:{lastLoginAt:new Date(),avatarUrl:user.avatarUrl||discordAvatar}});return this.session(user)}
  private discordRedirectUri(){return process.env.DISCORD_REDIRECT_URI||`${(process.env.PUBLIC_URL||process.env.WEB_URL||'http://localhost:3000').replace(/\/$/,'')}/api/auth/discord/callback`}
  private async session(user: { id: string; email: string; displayName: string; role: 'USER' | 'ADMIN' }) {
    const token = await this.jwt.signAsync({ sub: user.id, email: user.email, role: user.role });
    return { token, user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role } };
  }
  async me(id: string) {
    return this.prisma.user.findUniqueOrThrow({ where: { id }, select: { id: true, email: true, displayName: true, avatarUrl: true, role: true, status: true } });
  }
  async limits(id:string){const user=await this.prisma.user.findUniqueOrThrow({where:{id},include:{limits:{where:{scope:'USER'},take:1},plan:{include:{limits:{where:{scope:'PLAN'},take:1}}},bots:{include:{trafficPeriods:{where:{periodStart:{gte:new Date(Date.UTC(new Date().getUTCFullYear(),new Date().getUTCMonth(),1))}},take:1}}}}});const limit=user.limits[0]||user.plan?.limits[0]||await this.prisma.resourceLimit.findFirst({where:{scope:'PLAN',plan:{isDefault:true,enabled:true}}});const fallback:any={maxBots:5,cpuMillicores:250,totalCpuMillicores:1250,memoryMb:256,totalMemoryMb:1280,diskMb:1024,bandwidthIngressMb:10240,bandwidthEgressMb:10240,pidsLimit:100,maxUploadMb:100};const l:any=limit||fallback;return{maxBots:l.maxBots??5,cpuMillicores:l.cpuMillicores,memoryMb:l.memoryMb,totalCpuMillicores:l.totalCpuMillicores??l.cpuMillicores,totalMemoryMb:l.totalMemoryMb??l.memoryMb,diskMb:String(l.diskMb),bandwidthIngressMb:String(l.bandwidthIngressMb),bandwidthEgressMb:String(l.bandwidthEgressMb),pidsLimit:l.pidsLimit,maxUploadMb:l.maxUploadMb,usage:{cpuMillicores:Math.round(user.bots.reduce((n,b)=>n+b.cpuUsagePercent*10,0)),memoryMb:user.bots.reduce((n,b)=>n+b.memoryUsageMb,0),diskMb:user.bots.reduce((n,b)=>n+b.diskUsageMb,0),trafficMb:user.bots.reduce((n,b)=>n+Number((b.trafficPeriods[0]?.ingressBytes||0n)+(b.trafficPeriods[0]?.egressBytes||0n))/1048576,0),bots:user.bots.length}}}
}
