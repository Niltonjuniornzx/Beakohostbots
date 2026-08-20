import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { builtinModules } from 'module';
import { posix } from 'path';
import { unzipSync } from 'fflate';
import { PrismaService } from '../prisma/prisma.service';
import { BotFileDto, CreateBotDto, CreateEntryDto, ExtractArchiveDto, RenameEntryDto } from './bots.dto';

@Injectable()
export class BotsService {
  constructor(private readonly prisma: PrismaService) {}
  async availableRuntimes(){
    const nodes=await this.prisma.executionNode.findMany({where:{status:'ONLINE'},select:{runtimeImages:true,lastHeartbeatAt:true}});
    const counts=new Map<string,number>();
    for(const node of nodes.filter(node=>node.lastHeartbeatAt&&Date.now()-node.lastHeartbeatAt.getTime()<90000))for(const image of this.nodeImages(node.runtimeImages))counts.set(image,(counts.get(image)||0)+1);
    return [...counts].map(([image,onlineNodes])=>{const [repository,tag]=image.split(':');const dash=tag.lastIndexOf('-');const version=dash<0?tag:tag.slice(0,dash);const variant=(dash<0?'ALPINE':tag.slice(dash+1).toUpperCase());return{image,language:repository==='node'?'NODEJS':'PYTHON',label:repository==='node'?'Node.js':'Python',version,variant,onlineNodes}}).sort((a,b)=>a.language.localeCompare(b.language)||b.version.localeCompare(a.version));
  }
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
    const image=`${input.language==='NODEJS'?'node':'python'}:${input.version}-${input.variant.toLowerCase()}`;
    const nodes=await this.prisma.executionNode.findMany({where:{status:'ONLINE'},select:{id:true,runtimeImages:true,lastHeartbeatAt:true,_count:{select:{bots:true}}}});
    const compatible=nodes.filter(node=>node.lastHeartbeatAt&&Date.now()-node.lastHeartbeatAt.getTime()<90000&&this.nodeImages(node.runtimeImages).includes(image)).sort((a,b)=>a._count.bots-b._count.bots);
    if(!compatible.length)throw new BadRequestException('Nenhum Runner online possui este runtime. Atualize ou prepare uma VPS primeiro.');
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
    const node=compatible[0];
    return this.prisma.bot.create({ data: {
      userId, runtimeId: runtime.id, nodeId:node?.id, name: input.name.trim(), slug, entrypoint: input.entrypoint,
      startCommand: input.language === 'NODEJS' ? ['node', input.entrypoint] : ['python', input.entrypoint],
    }, include: { runtime: true } });
  }
  async deleteBot(userId:string,id:string){
    const admin=await this.isAdmin(userId);const bot=await this.prisma.bot.findFirst({where:{id,...(admin?{}:{userId})},select:{id:true,nodeId:true,node:{select:{status:true}}}});
    if(!bot)throw new NotFoundException('Bot não encontrado');
    if(bot.nodeId&&bot.node?.status==='ONLINE'){const active=await this.prisma.agentJob.count({where:{botId:id,status:{in:['QUEUED','RUNNING']}}});if(active)throw new BadRequestException('Aguarde a tarefa atual terminar antes de excluir');await this.prisma.agentJob.create({data:{nodeId:bot.nodeId,botId:id,action:'DELETE'}});await this.prisma.bot.update({where:{id},data:{status:'STOPPING'}});return{success:true,queued:true}}
    await this.prisma.bot.delete({where:{id}});return{success:true,queued:false}
  }
  async files(userId:string,id:string){await this.ownedBot(userId,id);const files=await this.prisma.botFile.findMany({where:{botId:id},select:{id:true,path:true,byteSize:true,updatedAt:true},orderBy:{path:'asc'}});return files.map(file=>file.path.endsWith('/.beako-dir')?{...file,path:file.path.slice(0,-11),isDirectory:true}:{...file,isDirectory:false})}
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
  async removeFile(userId:string,id:string,path:string){await this.ownedBot(userId,id);const safe=this.safePath(path);await this.prisma.botFile.deleteMany({where:{botId:id,OR:[{path:safe},{path:safe+'/.beako-dir'},{path:{startsWith:safe+'/'}}]}});await this.queueSync(id);return{success:true}}
  async fileContent(userId:string,id:string,path:string){await this.ownedBot(userId,id);const safe=this.safePath(path);const file=await this.prisma.botFile.findUnique({where:{botId_path:{botId:id,path:safe}}});if(!file)throw new NotFoundException('Arquivo não encontrado');if(file.byteSize>2*1024*1024)throw new BadRequestException('Arquivos acima de 2 MB não podem ser editados no navegador');const content=Buffer.from(file.content);if(content.includes(0))throw new BadRequestException('Arquivo binário não pode ser editado');return{path:safe,content:content.toString('utf8'),byteSize:file.byteSize,updatedAt:file.updatedAt}}
  async downloadFile(userId:string,id:string,path:string){await this.ownedBot(userId,id);const safe=this.safePath(path);const file=await this.prisma.botFile.findUnique({where:{botId_path:{botId:id,path:safe}},select:{path:true,content:true,byteSize:true,updatedAt:true}});if(!file)throw new NotFoundException('Arquivo não encontrado');return{path:safe,contentBase64:Buffer.from(file.content).toString('base64'),byteSize:file.byteSize,updatedAt:file.updatedAt}}
  async createEntry(userId:string,id:string,input:CreateEntryDto){await this.ownedBot(userId,id);const path=this.safePath(input.path).replace(/\/$/,'');const stored=input.type==='DIRECTORY'?path+'/.beako-dir':path;const exists=await this.prisma.botFile.count({where:{botId:id,path:stored}});if(exists)throw new BadRequestException('Já existe um item com este nome');await this.prisma.botFile.create({data:{botId:id,path:stored,content:Buffer.alloc(0),byteSize:0}});await this.queueSync(id);return{success:true,path,type:input.type}}
  async renameEntry(userId:string,id:string,input:RenameEntryDto){await this.ownedBot(userId,id);const from=this.safePath(input.from).replace(/\/$/,'');const to=this.safePath(input.to).replace(/\/$/,'');if(from===to)return{success:true};const sources=await this.prisma.botFile.findMany({where:{botId:id,OR:[{path:from},{path:from+'/.beako-dir'},{path:{startsWith:from+'/'}}]}});if(!sources.length)throw new NotFoundException('Arquivo ou pasta não encontrado');const changes=sources.map(file=>({file,path:file.path===from?to:file.path===from+'/.beako-dir'?to+'/.beako-dir':to+file.path.slice(from.length)}));for(const change of changes)if(await this.prisma.botFile.count({where:{botId:id,path:change.path,id:{not:change.file.id}}}))throw new BadRequestException('O destino já contém um item com o mesmo nome');await this.prisma.$transaction(changes.map(change=>this.prisma.botFile.update({where:{id:change.file.id},data:{path:change.path}})));await this.queueSync(id);return{success:true}}
  async extractArchive(userId:string,id:string,input:ExtractArchiveDto){await this.ownedBot(userId,id);const archivePath=this.safePath(input.path);if(!archivePath.toLowerCase().endsWith('.zip'))throw new BadRequestException('Selecione um arquivo .zip');const archive=await this.prisma.botFile.findUnique({where:{botId_path:{botId:id,path:archivePath}}});if(!archive)throw new NotFoundException('ZIP não encontrado');const limit=await this.prisma.resourceLimit.findFirst({where:{scope:'USER',userId}});const maxBytes=Number(limit?.diskMb??BigInt(1024))*1024*1024;let expected=0;let extracted:Record<string,Uint8Array>;try{extracted=unzipSync(new Uint8Array(archive.content),{filter:file=>{expected+=file.originalSize;if(expected>maxBytes)throw new Error('limit');return true}})}catch{throw new BadRequestException('ZIP inválido ou maior que o limite de armazenamento')};const destination=input.destination?this.safePath(input.destination).replace(/\/$/,''):posix.dirname(archivePath)==='.'?'':posix.dirname(archivePath);let count=0;for(const [raw,data] of Object.entries(extracted)){if(raw.endsWith('/'))continue;const clean=this.safePath(raw);const target=this.safePath([destination,clean].filter(Boolean).join('/'));await this.prisma.botFile.upsert({where:{botId_path:{botId:id,path:target}},update:{content:Buffer.from(data),byteSize:data.length},create:{botId:id,path:target,content:Buffer.from(data),byteSize:data.length}});count++}if(input.deleteArchive)await this.prisma.botFile.delete({where:{id:archive.id}});await this.queueSync(id);return{success:true,filesExtracted:count}}
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
    const existing=await this.prisma.botFile.findUnique({where:{botId_path:{botId:id,path:'package.json'}}});let manifest:any={name:'beakohost-bot',version:'1.0.0',private:true,main:bot.entrypoint};if(existing)try{manifest=JSON.parse(Buffer.from(existing.content).toString('utf8'))}catch{throw new BadRequestException('package.json inválido')};manifest.dependencies={...(manifest.dependencies||{})};for(const name of [...new Set(packages)])manifest.dependencies[name]=this.compatibleDependency(name)||manifest.dependencies[name]||'latest';for(const name of Object.keys(manifest.dependencies)){const version=this.compatibleDependency(name);if(version)manifest.dependencies[name]=version}const content=Buffer.from(JSON.stringify(manifest,null,2)+'\n');await this.prisma.botFile.upsert({where:{botId_path:{botId:id,path:'package.json'}},update:{content,byteSize:content.length},create:{botId:id,path:'package.json',content,byteSize:content.length}});
    const syncActive=await this.prisma.agentJob.count({where:{botId:id,action:'SYNC',status:{in:['QUEUED','RUNNING']}}});if(!syncActive)await this.prisma.agentJob.create({data:{nodeId:bot.nodeId,botId:id,action:'SYNC'}});const installActive=await this.prisma.agentJob.count({where:{botId:id,action:'INSTALL',status:{in:['QUEUED','RUNNING']}}});if(!installActive)await this.prisma.agentJob.create({data:{nodeId:bot.nodeId,botId:id,action:'INSTALL'}});return{success:true,packageJson:manifest};
  }
  async autoDeploy(userId:string,id:string){
    const admin=await this.isAdmin(userId);const bot=await this.prisma.bot.findFirst({where:{id,...(admin?{}:{userId})},select:{id:true,nodeId:true,entrypoint:true,runtime:{select:{language:true}}}});if(!bot)throw new NotFoundException('Bot não encontrado');if(!bot.nodeId)throw new BadRequestException('Aguardando um Runner compatível');
    if(bot.runtime.language==='NODEJS'){
      const info=await this.dependencies(userId,id);const existing=await this.prisma.botFile.findUnique({where:{botId_path:{botId:id,path:'package.json'}}});let manifest:any={name:'beakohost-bot',version:'1.0.0',private:true,main:bot.entrypoint,scripts:{start:`node ${bot.entrypoint}`}};if(existing)try{manifest=JSON.parse(Buffer.from(existing.content).toString('utf8'))}catch{throw new BadRequestException('package.json inválido')};manifest.dependencies={...(manifest.dependencies||{})};for(const name of info.missing)manifest.dependencies[name]=this.compatibleDependency(name)||'latest';for(const name of Object.keys(manifest.dependencies)){const version=this.compatibleDependency(name);if(version)manifest.dependencies[name]=version}const content=Buffer.from(JSON.stringify(manifest,null,2)+'\n');await this.prisma.botFile.upsert({where:{botId_path:{botId:id,path:'package.json'}},update:{content,byteSize:content.length},create:{botId:id,path:'package.json',content,byteSize:content.length}});
    }
    const existingDeploy=await this.prisma.agentJob.findFirst({where:{botId:id,action:'DEPLOY',status:{in:['QUEUED','RUNNING']}}});if(existingDeploy)return{success:true,queued:true,jobId:existingDeploy.id};
    const job=await this.prisma.agentJob.create({data:{nodeId:bot.nodeId,botId:id,action:'DEPLOY'}});await this.prisma.bot.update({where:{id},data:{status:'STARTING'}});return{success:true,queued:true,jobId:job.id};
  }
  async logs(userId:string,id:string){await this.ownedBot(userId,id);const chunks=await this.prisma.botLogChunk.findMany({where:{botId:id},orderBy:{lastTimestamp:'desc'},take:1});return{content:chunks[0]?.content||'',updatedAt:chunks[0]?.lastTimestamp||null}}
  private async queueSync(id:string){const bot=await this.prisma.bot.findUnique({where:{id},select:{nodeId:true}});if(!bot?.nodeId)return;const active=await this.prisma.agentJob.count({where:{botId:id,action:'SYNC',status:{in:['QUEUED','RUNNING']}}});if(!active)await this.prisma.agentJob.create({data:{nodeId:bot.nodeId,botId:id,action:'SYNC'}})}
  private async ownedBot(userId:string,id:string){const admin=await this.isAdmin(userId);const bot=await this.prisma.bot.findFirst({where:{id,...(admin?{}:{userId})},select:{id:true}});if(!bot)throw new NotFoundException('Bot não encontrado');return bot}
  private async isAdmin(userId:string){return Boolean(await this.prisma.user.count({where:{id:userId,role:'ADMIN',status:'ACTIVE'}}))}
  private nodeImages(value:unknown){return Array.isArray(value)?value.filter((item):item is string=>typeof item==='string'&&/^(node|python):[a-zA-Z0-9.-]+$/.test(item)):[]}
  private compatibleDependency(name:string){const versions:Record<string,string>={'node-telegram-bot-api':'0.66.0'};return versions[name]||null}
  private safePath(value:string){const normalized=posix.normalize(String(value||'').replace(/\\/g,'/')).replace(/^\.\//,'');if(!normalized||normalized==='.'||normalized.startsWith('/')||normalized==='..'||normalized.startsWith('../')||normalized.includes('/../')||normalized.length>240||!/^[a-zA-Z0-9_./@()+ -]+$/.test(normalized))throw new BadRequestException('Caminho inválido');return normalized}
}
