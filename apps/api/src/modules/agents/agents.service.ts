import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CompleteJobDto, EnrollAgentDto, HeartbeatDto } from './agents.dto';

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
      this.prisma.executionNode.update({where:{id:enrollment.nodeId},data:{status:'ONLINE',hostname:input.hostname||enrollment.node.hostname,agentTokenHash:digest(agentToken),agentVersion:input.agentVersion,totalCpuMillicores:input.totalCpuMillicores,totalMemoryMb:input.totalMemoryMb,totalDiskMb:BigInt(input.totalDiskMb),lastHeartbeatAt:new Date()}}),
    ]);
    return{nodeId:enrollment.nodeId,nodeName:enrollment.node.name,agentToken,heartbeatIntervalSeconds:30};
  }
  async heartbeat(authorization:string|undefined,input:HeartbeatDto){
    const node=await this.authenticate(authorization);
    await this.prisma.executionNode.update({where:{id:node.id},data:{status:'ONLINE',hostname:input.hostname||node.hostname,agentVersion:input.agentVersion,totalCpuMillicores:input.totalCpuMillicores,totalMemoryMb:input.totalMemoryMb,totalDiskMb:BigInt(input.totalDiskMb),lastHeartbeatAt:new Date()}});
    return{ok:true,nodeId:node.id,nextHeartbeatSeconds:30};
  }
  async nextJob(authorization:string|undefined){
    const node=await this.authenticate(authorization);
    const queued=await this.prisma.agentJob.findFirst({where:{nodeId:node.id,status:'QUEUED'},orderBy:{createdAt:'asc'},include:{bot:{include:{runtime:true,files:{select:{path:true,content:true,byteSize:true}},limits:{where:{scope:'BOT'},take:1},user:{select:{limits:{where:{scope:'USER'},take:1}}}}}}});
    if(!queued)return{job:null,pollAfterSeconds:3};
    const claimed=await this.prisma.agentJob.updateMany({where:{id:queued.id,status:'QUEUED'},data:{status:'RUNNING',startedAt:new Date()}});
    if(!claimed.count)return{job:null,pollAfterSeconds:1};
    const limit=queued.bot.limits[0]||queued.bot.user.limits[0];
    return{job:{id:queued.id,action:queued.action,bot:{id:queued.bot.id,entrypoint:queued.bot.entrypoint,image:`${queued.bot.runtime.imageRepository}:${queued.bot.runtime.imageTag}`,startCommand:queued.bot.startCommand,files:queued.bot.files.map(file=>({path:file.path,contentBase64:Buffer.from(file.content).toString('base64'),byteSize:file.byteSize})),limits:{cpuMillicores:limit?.cpuMillicores??250,memoryMb:limit?.memoryMb??256,pidsLimit:limit?.pidsLimit??100}}},pollAfterSeconds:0};
  }
  async completeJob(authorization:string|undefined,id:string,input:CompleteJobDto){
    const node=await this.authenticate(authorization);
    const job=await this.prisma.agentJob.findFirst({where:{id,nodeId:node.id,status:'RUNNING'}});
    if(!job)throw new UnauthorizedException('Tarefa inválida ou já concluída');
    const status=input.success?'SUCCEEDED':'FAILED';
    await this.prisma.$transaction(async tx=>{
      await tx.agentJob.update({where:{id},data:{status,output:input.output?.slice(-200000),error:input.error?.slice(0,4000),containerId:input.containerId,finishedAt:new Date()}});
      if(input.success&&job.action==='START')await tx.bot.update({where:{id:job.botId},data:{status:'RUNNING',containerId:input.containerId,lastStartedAt:new Date()}});
      if(input.success&&job.action==='STOP')await tx.bot.update({where:{id:job.botId},data:{status:'STOPPED',containerId:null,lastStoppedAt:new Date()}});
      if(input.success&&job.action==='RESTART')await tx.bot.update({where:{id:job.botId},data:{status:'RUNNING',containerId:input.containerId,lastStartedAt:new Date()}});
      if(!input.success&&(job.action==='START'||job.action==='RESTART'))await tx.bot.update({where:{id:job.botId},data:{status:'CRASHED'}});
    });
    return{ok:true};
  }
  private async authenticate(authorization:string|undefined){const token=authorization?.startsWith('Bearer ')?authorization.slice(7):'';if(!token)throw new UnauthorizedException('Credencial do agente ausente');const node=await this.prisma.executionNode.findFirst({where:{agentTokenHash:digest(token)}});if(!node)throw new UnauthorizedException('Credencial do agente inválida');return node}
}
