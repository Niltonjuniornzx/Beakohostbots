import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EnrollAgentDto, HeartbeatDto } from './agents.dto';

const digest=(value:string)=>createHash('sha256').update(value).digest('hex');

@Injectable()
export class AgentsService {
  constructor(private readonly prisma:PrismaService){}
  async enroll(input:EnrollAgentDto){
    const enrollment=await this.prisma.nodeEnrollment.findUnique({where:{tokenHash:digest(input.token)},include:{node:true}});
    if(!enrollment||enrollment.consumedAt||enrollment.expiresAt<=new Date())throw new UnauthorizedException('Token inválido, expirado ou já utilizado');
    const agentToken=randomBytes(32).toString('base64url');
    await this.prisma.$transaction([
      this.prisma.nodeEnrollment.update({where:{id:enrollment.id},data:{consumedAt:new Date()}}),
      this.prisma.executionNode.update({where:{id:enrollment.nodeId},data:{status:'ONLINE',agentTokenHash:digest(agentToken),agentVersion:input.agentVersion,totalCpuMillicores:input.totalCpuMillicores,totalMemoryMb:input.totalMemoryMb,totalDiskMb:BigInt(input.totalDiskMb),lastHeartbeatAt:new Date()}}),
    ]);
    return{nodeId:enrollment.nodeId,nodeName:enrollment.node.name,agentToken,heartbeatIntervalSeconds:30};
  }
  async heartbeat(authorization:string|undefined,input:HeartbeatDto){
    const token=authorization?.startsWith('Bearer ')?authorization.slice(7):'';
    if(!token)throw new UnauthorizedException('Credencial do agente ausente');
    const node=await this.prisma.executionNode.findFirst({where:{agentTokenHash:digest(token)}});
    if(!node)throw new UnauthorizedException('Credencial do agente inválida');
    await this.prisma.executionNode.update({where:{id:node.id},data:{status:'ONLINE',agentVersion:input.agentVersion,totalCpuMillicores:input.totalCpuMillicores,totalMemoryMb:input.totalMemoryMb,totalDiskMb:BigInt(input.totalDiskMb),lastHeartbeatAt:new Date()}});
    return{ok:true,nodeId:node.id,nextHeartbeatSeconds:30};
  }
}
