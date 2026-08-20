import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { BotTelemetryDto, CompleteJobDto, EnrollAgentDto, HeartbeatDto } from './agents.dto';
import { EnvService } from '../env/env.service';

const digest=(value:string)=>createHash('sha256').update(value).digest('hex');

@Injectable()
export class AgentsService {
  constructor(private readonly prisma:PrismaService,private readonly env:EnvService){}
  async enroll(input:EnrollAgentDto){
    const enrollment=await this.prisma.nodeEnrollment.findUnique({where:{tokenHash:digest(input.token)},include:{node:true}});
    if(!enrollment||enrollment.consumedAt||enrollment.expiresAt<=new Date())throw new UnauthorizedException('Token inválido, expirado ou já utilizado');
    const agentToken=randomBytes(32).toString('base64url');
    await this.prisma.$transaction([
      this.prisma.nodeEnrollment.update({where:{id:enrollment.id},data:{consumedAt:new Date()}}),
      this.prisma.executionNode.update({where:{id:enrollment.nodeId},data:{status:'ONLINE',hostname:input.hostname||enrollment.node.hostname,agentTokenHash:digest(agentToken),agentVersion:input.agentVersion,runnerInstanceId:input.runnerInstanceId,totalCpuMillicores:input.totalCpuMillicores,totalMemoryMb:input.totalMemoryMb,totalDiskMb:BigInt(input.totalDiskMb),runtimeImages:input.runtimeImages,setupStatus:input.setupStatus,setupLog:input.setupLog?.slice(-50000),lastHeartbeatAt:new Date()}}),
    ]);
    return{nodeId:enrollment.nodeId,nodeName:enrollment.node.name,agentToken,heartbeatIntervalSeconds:30};
  }
  async heartbeat(authorization:string|undefined,input:HeartbeatDto){
    const node=await this.authenticate(authorization);
    const reconnecting=!node.lastHeartbeatAt||Date.now()-node.lastHeartbeatAt.getTime()>90000||Boolean(input.runnerInstanceId&&input.runnerInstanceId!==node.runnerInstanceId);
    await this.prisma.executionNode.update({where:{id:node.id},data:{status:'ONLINE',hostname:input.hostname||node.hostname,agentVersion:input.agentVersion,runnerInstanceId:input.runnerInstanceId,totalCpuMillicores:input.totalCpuMillicores,totalMemoryMb:input.totalMemoryMb,totalDiskMb:BigInt(input.totalDiskMb),runtimeImages:input.runtimeImages,setupStatus:input.setupStatus,setupLog:input.setupLog?.slice(-50000),lastHeartbeatAt:new Date()}});
    await this.prisma.bot.updateMany({where:{nodeId:null},data:{nodeId:node.id}});
    if(reconnecting){
      const desired=await this.prisma.bot.findMany({where:{nodeId:node.id,status:{in:['RUNNING','STARTING']}},select:{id:true}});
      for(const bot of desired){const active=await this.prisma.agentJob.count({where:{botId:bot.id,status:{in:['QUEUED','RUNNING']}}});if(!active)await this.prisma.agentJob.create({data:{nodeId:node.id,botId:bot.id,action:'RECONCILE'}})}
    }
    return{ok:true,nodeId:node.id,nextHeartbeatSeconds:30};
  }
  async nextJob(authorization:string|undefined){
    const node=await this.authenticate(authorization);
    const queued=await this.prisma.agentJob.findFirst({where:{nodeId:node.id,status:'QUEUED'},orderBy:{createdAt:'asc'},include:{bot:{include:{runtime:true,files:{select:{path:true,content:true,byteSize:true}},limits:{where:{scope:'BOT'},take:1},user:{select:{limits:{where:{scope:'USER'},take:1},plan:{select:{limits:{where:{scope:'PLAN'},take:1}}}}}}}}});
    if(!queued){const monitorBotIds=await this.prisma.bot.findMany({where:{nodeId:node.id,status:{in:['RUNNING','STARTING','CRASHED']}},select:{id:true}});return{job:null,pollAfterSeconds:3,monitorBotIds:monitorBotIds.map(bot=>bot.id)}};
    const environment=await this.env.resolvedForRunner(queued.bot.id);
    const claimed=await this.prisma.agentJob.updateMany({where:{id:queued.id,status:'QUEUED'},data:{status:'RUNNING',startedAt:new Date()}});
    if(!claimed.count)return{job:null,pollAfterSeconds:1};
    const limit=queued.bot.limits[0]||queued.bot.user.limits[0]||queued.bot.user.plan?.limits[0];
    return{job:{id:queued.id,action:queued.action,bot:{id:queued.bot.id,entrypoint:queued.bot.entrypoint,image:`${queued.bot.runtime.imageRepository}:${queued.bot.runtime.imageTag}`,startCommand:queued.bot.startCommand,environment,files:queued.bot.files.filter(file=>!file.path.split('/').includes('.env')&&!file.path.endsWith('/.beako-dir')).map(file=>({path:file.path,contentBase64:Buffer.from(file.content).toString('base64'),byteSize:file.byteSize})),limits:{cpuMillicores:limit?.cpuMillicores??250,memoryMb:limit?.memoryMb??256,memorySwapMb:limit?.memorySwapMb??256,diskMb:Number(limit?.diskMb??1024n),pidsLimit:limit?.pidsLimit??100,maxUploadMb:limit?.maxUploadMb??100,restartPolicy:limit?.restartPolicy??'ON_FAILURE',maxRestartCount:limit?.maxRestartCount??5,crashLoopWindowSeconds:limit?.crashLoopWindowSeconds??300}}},pollAfterSeconds:0};
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
      if(input.success&&job.action==='DEPLOY')await tx.bot.update({where:{id:job.botId},data:{status:'RUNNING',containerId:input.containerId,lastStartedAt:new Date()}});
      if(input.success&&job.action==='RECONCILE')await tx.bot.update({where:{id:job.botId},data:{status:'RUNNING',containerId:input.containerId,lastStartedAt:new Date()}});
      if(input.success&&job.action==='DELETE'){await tx.bot.delete({where:{id:job.botId}});return}
      if(!input.success&&(job.action==='START'||job.action==='RESTART'||job.action==='DEPLOY'||job.action==='RECONCILE'))await tx.bot.update({where:{id:job.botId},data:{status:'CRASHED'}});
    });
    return{ok:true};
  }
  async telemetry(authorization:string|undefined,id:string,input:BotTelemetryDto){
    const node=await this.authenticate(authorization);
    const bot=await this.prisma.bot.findFirst({
      where:{id,nodeId:node.id},
      include:{
        limits:{where:{scope:'BOT'},take:1},
        user:{include:{limits:{where:{scope:'USER'},take:1},plan:{include:{limits:{where:{scope:'PLAN'},take:1}}}}},
      },
    });
    if(!bot)throw new UnauthorizedException('Bot não pertence a este Runner');
    const now=new Date(),periodStart=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1));
    const ingress=BigInt(input.networkIngressBytes??0),egress=BigInt(input.networkEgressBytes??0);
    const deltaIn=ingress>=bot.lastNetworkIngressBytes?ingress-bot.lastNetworkIngressBytes:ingress;
    const deltaOut=egress>=bot.lastNetworkEgressBytes?egress-bot.lastNetworkEgressBytes:egress;
    const wasRunning=bot.status==='RUNNING';
    const crashWindowExpired=Boolean(input.running&&bot.crashWindowStartedAt&&now.getTime()-bot.crashWindowStartedAt.getTime()>(bot.limits[0]?.crashLoopWindowSeconds||bot.user.limits[0]?.crashLoopWindowSeconds||bot.user.plan?.limits[0]?.crashLoopWindowSeconds||300)*1000);
    await this.prisma.$transaction(async tx=>{
      await tx.botLogChunk.deleteMany({where:{botId:id}});
      if(input.logs)await tx.botLogChunk.create({data:{botId:id,stream:'combined',content:input.logs.slice(-200000),firstTimestamp:now,lastTimestamp:now,byteSize:Buffer.byteLength(input.logs),expiresAt:new Date(Date.now()+7*86400000)}});
      if(deltaIn||deltaOut)await tx.trafficPeriod.upsert({where:{botId_periodStart:{botId:id,periodStart}},create:{botId:id,periodStart,ingressBytes:deltaIn,egressBytes:deltaOut},update:{ingressBytes:{increment:deltaIn},egressBytes:{increment:deltaOut}}});
      if(input.oomKilled&&wasRunning)await tx.resourceEvent.create({data:{botId:id,kind:'OOM',message:'Container encerrado pelo limite de memória'}});
      await tx.bot.update({where:{id},data:{cpuUsagePercent:input.cpuUsagePercent??bot.cpuUsagePercent,memoryUsageMb:input.memoryUsageMb??bot.memoryUsageMb,diskUsageMb:input.diskUsageMb??bot.diskUsageMb,lastNetworkIngressBytes:ingress,lastNetworkEgressBytes:egress,lastMetricsAt:now,...(crashWindowExpired?{crashCount:0,crashWindowStartedAt:null}:{}),...(input.running?{status:'RUNNING' as const}:wasRunning?{status:'CRASHED' as const,lastExitCode:input.exitCode}:{})}});
    });
    const limit=bot.limits[0]||bot.user.limits[0]||bot.user.plan?.limits[0];
    const period=await this.prisma.trafficPeriod.findUnique({where:{botId_periodStart:{botId:id,periodStart}}});
    const used=(period?.ingressBytes||0n)+(period?.egressBytes||0n);
    const allowed=((limit?.bandwidthIngressMb||0n)+(limit?.bandwidthEgressMb||0n))*1048576n;
    if(limit?.suspendOnTrafficLimit&&allowed>0n&&used>=allowed&&bot.status!=='SUSPENDED'){
      await this.prisma.bot.update({where:{id},data:{status:'SUSPENDED'}});
      await this.prisma.resourceEvent.create({data:{botId:id,kind:'TRAFFIC_LIMIT',message:'Bot suspenso ao atingir o tráfego mensal'}});
      return{ok:true,action:'STOP'};
    }
    if(!input.running&&wasRunning){
      const policy=limit?.restartPolicy??'ON_FAILURE';
      const windowMs=(limit?.crashLoopWindowSeconds??300)*1000;
      const inWindow=Boolean(bot.crashWindowStartedAt&&now.getTime()-bot.crashWindowStartedAt.getTime()<=windowMs);
      const crashCount=inWindow?bot.crashCount+1:1;
      const windowStart=inWindow&&bot.crashWindowStartedAt?bot.crashWindowStartedAt:now;
      if(policy!=='NEVER'&&crashCount<=(limit?.maxRestartCount??5)){
        const active=await this.prisma.agentJob.count({where:{botId:id,status:{in:['QUEUED','RUNNING']}}});
        if(!active)await this.prisma.$transaction([this.prisma.bot.update({where:{id},data:{status:'STARTING',crashCount,crashWindowStartedAt:windowStart}}),this.prisma.agentJob.create({data:{nodeId:node.id,botId:id,action:'RESTART'}})]);
      }else{
        await this.prisma.bot.update({where:{id},data:{status:'CRASHED',crashCount,crashWindowStartedAt:windowStart}});
        if(policy!=='NEVER')await this.prisma.resourceEvent.create({data:{botId:id,kind:'CRASH_LOOP',message:`Reinício bloqueado após ${crashCount} falhas em ${Math.round(windowMs/1000)} segundos`}});
      }
    }
    return{ok:true};
  }
  private async authenticate(authorization:string|undefined){const token=authorization?.startsWith('Bearer ')?authorization.slice(7):'';if(!token)throw new UnauthorizedException('Credencial do agente ausente');const node=await this.prisma.executionNode.findFirst({where:{agentTokenHash:digest(token)}});if(!node)throw new UnauthorizedException('Credencial do agente inválida');return node}
}
