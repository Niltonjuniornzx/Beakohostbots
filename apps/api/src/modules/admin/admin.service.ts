import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNodeDto, MoveBotDto, UpdateNodeDto, UpdateUserDto, UserLimitsDto } from './admin.dto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}
  async overview() {
    const [users,bots,nodes,running,suspended]=await Promise.all([this.prisma.user.count(),this.prisma.bot.count(),this.prisma.executionNode.count(),this.prisma.bot.count({where:{status:'RUNNING'}}),this.prisma.user.count({where:{status:'SUSPENDED'}})]);
    return { users,bots,nodes,running,suspended };
  }
  users(){return this.prisma.user.findMany({select:{id:true,email:true,displayName:true,role:true,status:true,lastLoginAt:true,createdAt:true,_count:{select:{bots:true}}},orderBy:{createdAt:'desc'}})}
  async updateUser(actorId:string,id:string,input:UpdateUserDto){
    if(actorId===id&&(input.role!=='ADMIN'||input.status!=='ACTIVE'))throw new BadRequestException('Você não pode remover ou suspender seu próprio acesso administrativo');
    return this.prisma.user.update({where:{id},data:{role:input.role,status:input.status},select:{id:true,email:true,displayName:true,role:true,status:true}}).catch(()=>{throw new NotFoundException('Usuário não encontrado')});
  }
  async userDetail(id:string){const user=await this.prisma.user.findUnique({where:{id},select:{id:true,email:true,displayName:true,role:true,status:true,createdAt:true,lastLoginAt:true,bots:{include:{runtime:true,node:{select:{id:true,name:true}}},orderBy:{createdAt:'desc'}},limits:{where:{scope:'USER'},take:1}}});if(!user)throw new NotFoundException('Usuário não encontrado');return{...user,limits:user.limits.map(limit=>({...limit,diskMb:limit.diskMb.toString(),bandwidthIngressMb:limit.bandwidthIngressMb.toString(),bandwidthEgressMb:limit.bandwidthEgressMb.toString()}))}}
  async saveUserLimits(userId:string,input:UserLimitsDto){if(!await this.prisma.user.count({where:{id:userId}}))throw new NotFoundException('Usuário não encontrado');const existing=await this.prisma.resourceLimit.findFirst({where:{scope:'USER',userId}});const data={scope:'USER' as const,userId,maxBots:input.maxBots,cpuMillicores:input.cpuMillicores,memoryMb:input.memoryMb,memorySwapMb:input.memorySwapMb,diskMb:BigInt(input.diskMb),bandwidthIngressMb:BigInt(input.bandwidthIngressMb),bandwidthEgressMb:BigInt(input.bandwidthEgressMb),networkRateKbps:input.networkRateKbps||null,pidsLimit:input.pidsLimit,maxUploadMb:input.maxUploadMb,sftpRateKbps:input.sftpRateKbps||null};const limit=existing?await this.prisma.resourceLimit.update({where:{id:existing.id},data}):await this.prisma.resourceLimit.create({data});return{...limit,diskMb:limit.diskMb.toString(),bandwidthIngressMb:limit.bandwidthIngressMb.toString(),bandwidthEgressMb:limit.bandwidthEgressMb.toString()}}
  async nodes(){const nodes=await this.prisma.executionNode.findMany({include:{_count:{select:{bots:true}}},orderBy:{createdAt:'desc'}});return nodes.map(({agentTokenHash,...node})=>({...node,status:node.lastHeartbeatAt&&Date.now()-node.lastHeartbeatAt.getTime()>90000?'OFFLINE':node.status,totalDiskMb:node.totalDiskMb.toString()}))}
  async createNode(input:CreateNodeDto){
    const token=randomBytes(32).toString('base64url'); const tokenHash=createHash('sha256').update(token).digest('hex');
    const node=await this.prisma.executionNode.create({data:{name:input.name.trim(),hostname:input.hostname.trim(),totalCpuMillicores:input.totalCpuMillicores,totalMemoryMb:input.totalMemoryMb,totalDiskMb:BigInt(input.totalDiskMb),enrollments:{create:{tokenHash,expiresAt:new Date(Date.now()+15*60*1000)}}}});
    const {agentTokenHash,...safeNode}=node;
    return {...safeNode,totalDiskMb:node.totalDiskMb.toString(),enrollmentToken:token,expiresInSeconds:900};
  }
  async updateNode(id:string,input:UpdateNodeDto){const node=await this.prisma.executionNode.update({where:{id},data:{status:input.status}}).catch(()=>{throw new NotFoundException('Servidor não encontrado')});const{agentTokenHash,...safeNode}=node;return{...safeNode,totalDiskMb:node.totalDiskMb.toString()}}
  async deleteNode(id:string){const count=await this.prisma.bot.count({where:{nodeId:id}});if(count)throw new ConflictException(`Migre os ${count} bot(s) antes de remover este servidor`);await this.prisma.executionNode.delete({where:{id}}).catch(()=>{throw new NotFoundException('Servidor não encontrado')});return{success:true}}
  bots(){return this.prisma.bot.findMany({include:{user:{select:{displayName:true,email:true}},runtime:true,node:{select:{id:true,name:true,status:true}}},orderBy:{createdAt:'desc'}})}
  async moveBot(id:string,input:MoveBotDto){const bot=await this.prisma.bot.findUnique({where:{id}});if(!bot)throw new NotFoundException('Bot não encontrado');if(bot.status!=='STOPPED')throw new ConflictException('Pare o bot antes de migrá-lo');const node=await this.prisma.executionNode.findUnique({where:{id:input.nodeId}});if(!node||node.status!=='ONLINE')throw new BadRequestException('O servidor de destino precisa estar online');return this.prisma.bot.update({where:{id},data:{nodeId:node.id},include:{node:true}})}
}
