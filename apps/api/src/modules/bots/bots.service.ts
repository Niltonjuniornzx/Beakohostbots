import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { builtinModules } from 'module';
import { PrismaService } from '../prisma/prisma.service';
import { BotFileDto, CreateBotDto } from './bots.dto';

@Injectable()
export class BotsService {
  constructor(private readonly prisma: PrismaService) {}
  list(userId: string) {
    return this.prisma.bot.findMany({ where: { userId }, include: { runtime: true, node: { select: { id: true, name: true, status: true } } }, orderBy: { createdAt: 'desc' } });
  }
  async get(userId: string, id: string) {
    const admin=await this.isAdmin(userId);const bot = await this.prisma.bot.findFirst({ where: { id,...(admin?{}:{userId}) }, include: { runtime: true, node: {select:{id:true,name:true,status:true,agentVersion:true}} } });
    if (!bot) throw new NotFoundException('Bot não encontrado');
    return bot;
  }
  async create(userId: string, input: CreateBotDto) {
    const [limit,currentBots]=await Promise.all([this.prisma.resourceLimit.findFirst({where:{scope:'USER',userId}}),this.prisma.bot.count({where:{userId}})]);
    const maxBots=limit?.maxBots??5;
    if(currentBots>=maxBots)throw new BadRequestException(`Você atingiu o limite de ${maxBots} bot(s)`);
    if (input.language === 'NODEJS' && !['20', '22', '24', '26'].includes(input.version)) throw new BadRequestException('Versão Node.js inválida');
    if (input.language === 'PYTHON' && !['3.10', '3.11', '3.12', '3.13', '3.14'].includes(input.version)) throw new BadRequestException('Versão Python inválida');
    const slugBase = input.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'bot';
    const slug = `${slugBase}-${Math.random().toString(36).slice(2, 7)}`;
    const runtime = await this.prisma.runtime.upsert({
      where: { language_version_variant: { language: input.language, version: input.version, variant: input.variant } },
      update: {},
      create: {
        language: input.language, version: input.version, variant: input.variant,
        imageRepository: input.language === 'NODEJS' ? 'node' : 'python', imageTag: `${input.version}-${input.variant.toLowerCase()}`,
        imageDigest: 'pending-verification', installCommand: input.language === 'NODEJS' ? ['npm', 'ci'] : ['pip', 'install', '-r', 'requirements.txt'],
        defaultStartCommand: input.language === 'NODEJS' ? ['node'] : ['python'],
      },
    });
    const node=await this.prisma.executionNode.findFirst({where:{status:'ONLINE'},orderBy:{bots:{_count:'asc'}}});
    return this.prisma.bot.create({ data: {
      userId, runtimeId: runtime.id, nodeId:node?.id, name: input.name.trim(), slug, entrypoint: input.entrypoint,
      startCommand: input.language === 'NODEJS' ? ['node', input.entrypoint] : ['python', input.entrypoint],
    }, include: { runtime: true } });
  }
  async files(userId:string,id:string){await this.ownedBot(userId,id);return this.prisma.botFile.findMany({where:{botId:id},select:{id:true,path:true,byteSize:true,updatedAt:true},orderBy:{path:'asc'}})}
  async uploadFile(userId:string,id:string,input:BotFileDto){
    await this.ownedBot(userId,id);
    const content=Buffer.from(input.contentBase64,'base64');
    const limit=await this.prisma.resourceLimit.findFirst({where:{scope:'USER',userId}});
    const maxUpload=(limit?.maxUploadMb??100)*1024*1024;
    if(content.length>maxUpload)throw new BadRequestException(`Arquivo maior que o limite de ${limit?.maxUploadMb??100} MB`);
    const current=await this.prisma.botFile.aggregate({where:{botId:id,path:{not:input.path}},_sum:{byteSize:true}});
    const diskLimit=Number(limit?.diskMb??BigInt(1024))*1024*1024;
    if((current._sum.byteSize??0)+content.length>diskLimit)throw new BadRequestException('O bot atingiu o limite de armazenamento');
    const file=await this.prisma.botFile.upsert({where:{botId_path:{botId:id,path:input.path}},update:{content,byteSize:content.length},create:{botId:id,path:input.path,content,byteSize:content.length},select:{id:true,path:true,byteSize:true,updatedAt:true}});
    await this.queueSync(id);
    return file;
  }
  async removeFile(userId:string,id:string,path:string){await this.ownedBot(userId,id);await this.prisma.botFile.deleteMany({where:{botId:id,path}});await this.queueSync(id);return{success:true}}
  async action(userId:string,id:string,action:string){const admin=await this.isAdmin(userId);const bot=await this.prisma.bot.findFirst({where:{id,...(admin?{}:{userId})},select:{id:true,nodeId:true,node:{select:{status:true}}}});if(!bot)throw new NotFoundException('Bot não encontrado');if(!bot.nodeId||bot.node?.status!=='ONLINE')throw new BadRequestException('Atribua um Runner online a este bot');const active=await this.prisma.agentJob.findFirst({where:{botId:id,status:{in:['QUEUED','RUNNING']}}});if(active)throw new BadRequestException('Já existe uma tarefa em andamento para este bot');if(action==='INSTALL')await this.prisma.agentJob.create({data:{nodeId:bot.nodeId,botId:id,action:'SYNC'}});const job=await this.prisma.agentJob.create({data:{nodeId:bot.nodeId,botId:id,action}});if(action==='START')await this.prisma.bot.update({where:{id},data:{status:'STARTING'}});if(action==='STOP')await this.prisma.bot.update({where:{id},data:{status:'STOPPING'}});return job}
  async jobs(userId:string,id:string){await this.ownedBot(userId,id);return this.prisma.agentJob.findMany({where:{botId:id},select:{id:true,action:true,status:true,output:true,error:true,createdAt:true,startedAt:true,finishedAt:true},orderBy:{createdAt:'desc'},take:20})}
  async dependencies(userId:string,id:string){
    await this.ownedBot(userId,id);
    const files=await this.prisma.botFile.findMany({where:{botId:id},select:{path:true,content:true}});
    const detected=new Set<string>();const builtins=new Set([...builtinModules,...builtinModules.map(name=>'node:'+name)]);
    const pattern=/(?:require\s*\(\s*|from\s+|import\s*\(\s*|import\s+)["']([^"']+)["']/g;
    for(const file of files.filter(file=>/\.(?:js|cjs|mjs|ts|tsx|jsx)$/.test(file.path))){const source=Buffer.from(file.content).toString('utf8');let match:RegExpExecArray|null;while((match=pattern.exec(source))){const spec=match[1];if(spec.startsWith('.')||spec.startsWith('/')||builtins.has(spec))continue;detected.add(spec.startsWith('@')?spec.split('/').slice(0,2).join('/'):spec.split('/')[0])}}
    let declared:Record<string,string>={};const manifest=files.find(file=>file.path==='package.json');if(manifest)try{const parsed=JSON.parse(Buffer.from(manifest.content).toString('utf8'));declared={...(parsed.dependencies||{}),...(parsed.devDependencies||{})}}catch{}
    const all=[...detected].sort();return{detected:all,declared:Object.keys(declared).sort(),missing:all.filter(name=>!declared[name]),hasPackageJson:Boolean(manifest)};
  }
  async installDependencies(userId:string,id:string,packages:string[]){
    const admin=await this.isAdmin(userId);const bot=await this.prisma.bot.findFirst({where:{id,...(admin?{}:{userId})},select:{id:true,nodeId:true,entrypoint:true,runtime:{select:{language:true}}}});if(!bot)throw new NotFoundException('Bot não encontrado');if(bot.runtime.language!=='NODEJS')return this.action(userId,id,'INSTALL');if(!bot.nodeId)throw new BadRequestException('Bot sem Runner atribuído');
    const existing=await this.prisma.botFile.findUnique({where:{botId_path:{botId:id,path:'package.json'}}});let manifest:any={name:'beakohost-bot',version:'1.0.0',private:true,main:bot.entrypoint};if(existing)try{manifest=JSON.parse(Buffer.from(existing.content).toString('utf8'))}catch{throw new BadRequestException('package.json inválido')};manifest.dependencies={...(manifest.dependencies||{})};for(const name of [...new Set(packages)])manifest.dependencies[name]=manifest.dependencies[name]||'latest';const content=Buffer.from(JSON.stringify(manifest,null,2)+'\n');await this.prisma.botFile.upsert({where:{botId_path:{botId:id,path:'package.json'}},update:{content,byteSize:content.length},create:{botId:id,path:'package.json',content,byteSize:content.length}});
    const syncActive=await this.prisma.agentJob.count({where:{botId:id,action:'SYNC',status:{in:['QUEUED','RUNNING']}}});if(!syncActive)await this.prisma.agentJob.create({data:{nodeId:bot.nodeId,botId:id,action:'SYNC'}});const installActive=await this.prisma.agentJob.count({where:{botId:id,action:'INSTALL',status:{in:['QUEUED','RUNNING']}}});if(!installActive)await this.prisma.agentJob.create({data:{nodeId:bot.nodeId,botId:id,action:'INSTALL'}});return{success:true,packageJson:manifest};
  }
  async logs(userId:string,id:string){await this.ownedBot(userId,id);const chunks=await this.prisma.botLogChunk.findMany({where:{botId:id},orderBy:{lastTimestamp:'desc'},take:1});return{content:chunks[0]?.content||'',updatedAt:chunks[0]?.lastTimestamp||null}}
  private async queueSync(id:string){const bot=await this.prisma.bot.findUnique({where:{id},select:{nodeId:true}});if(!bot?.nodeId)return;const active=await this.prisma.agentJob.count({where:{botId:id,action:'SYNC',status:{in:['QUEUED','RUNNING']}}});if(!active)await this.prisma.agentJob.create({data:{nodeId:bot.nodeId,botId:id,action:'SYNC'}})}
  private async ownedBot(userId:string,id:string){const admin=await this.isAdmin(userId);const bot=await this.prisma.bot.findFirst({where:{id,...(admin?{}:{userId})},select:{id:true}});if(!bot)throw new NotFoundException('Bot não encontrado');return bot}
  private async isAdmin(userId:string){return Boolean(await this.prisma.user.count({where:{id:userId,role:'ADMIN',status:'ACTIVE'}}))}
}
