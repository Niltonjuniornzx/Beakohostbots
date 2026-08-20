import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNodeDto, MoveBotDto, UpdateNodeDto, UpdateUserDto } from './admin.dto';

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
  async nodes(){const nodes=await this.prisma.executionNode.findMany({include:{_count:{select:{bots:true}}},orderBy:{createdAt:'desc'}});return nodes.map(node=>({...node,totalDiskMb:node.totalDiskMb.toString()}))}
  async createNode(input:CreateNodeDto){
    const token=randomBytes(32).toString('base64url'); const tokenHash=createHash('sha256').update(token).digest('hex');
    const node=await this.prisma.executionNode.create({data:{name:input.name.trim(),hostname:input.hostname.trim(),totalCpuMillicores:input.totalCpuMillicores,totalMemoryMb:input.totalMemoryMb,totalDiskMb:BigInt(input.totalDiskMb),enrollments:{create:{tokenHash,expiresAt:new Date(Date.now()+15*60*1000)}}}});
    return {...node,totalDiskMb:node.totalDiskMb.toString(),enrollmentToken:token,expiresInSeconds:900};
  }
  async updateNode(id:string,input:UpdateNodeDto){const node=await this.prisma.executionNode.update({where:{id},data:{status:input.status}}).catch(()=>{throw new NotFoundException('Servidor não encontrado')});return{...node,totalDiskMb:node.totalDiskMb.toString()}}
  async deleteNode(id:string){const count=await this.prisma.bot.count({where:{nodeId:id}});if(count)throw new ConflictException(`Migre os ${count} bot(s) antes de remover este servidor`);await this.prisma.executionNode.delete({where:{id}}).catch(()=>{throw new NotFoundException('Servidor não encontrado')});return{success:true}}
  bots(){return this.prisma.bot.findMany({include:{user:{select:{displayName:true,email:true}},runtime:true,node:{select:{id:true,name:true,status:true}}},orderBy:{createdAt:'desc'}})}
  async moveBot(id:string,input:MoveBotDto){const bot=await this.prisma.bot.findUnique({where:{id}});if(!bot)throw new NotFoundException('Bot não encontrado');if(bot.status!=='STOPPED')throw new ConflictException('Pare o bot antes de migrá-lo');const node=await this.prisma.executionNode.findUnique({where:{id:input.nodeId}});if(!node||node.status!=='ONLINE')throw new BadRequestException('O servidor de destino precisa estar online');return this.prisma.bot.update({where:{id},data:{nodeId:node.id},include:{node:true}})}
}
