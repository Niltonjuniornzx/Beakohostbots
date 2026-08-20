import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEnvDto, envKeyPattern, UpdateEnvDto } from './env.dto';
import { EnvCryptoService } from './env.crypto';
import { parseEnv, reservedEnvKeys, validateEnv } from './env.validation';


@Injectable()
export class EnvService {
  constructor(private readonly prisma: PrismaService, private readonly crypto: EnvCryptoService) {}

  async list(actorId: string, botId: string) {
    await this.authorize(actorId, botId);
    const [variables, legacy] = await Promise.all([
      this.prisma.envVariable.findMany({ where: { botId }, select: { id:true,key:true,isSecret:true,createdAt:true,updatedAt:true }, orderBy: { key:'asc' } }),
      this.prisma.botFile.count({ where: { botId, path:'.env' } }),
    ]);
    return { variables: variables.map(item => ({ ...item, configured:true, maskedValue:'••••••••••••' })), legacyEnvFile: legacy > 0 };
  }

  async detected(actorId: string, botId: string) {
    await this.authorize(actorId, botId);
    const [files, configured] = await Promise.all([
      this.prisma.botFile.findMany({ where: { botId, path: { not:'.env' } }, select: { path:true,content:true } }),
      this.prisma.envVariable.findMany({ where: { botId }, select: { key:true } }),
    ]);
    const names = new Set<string>();
    for (const file of files) {
      if (/\.(?:js|cjs|mjs|ts|tsx|jsx)$/.test(file.path)) {
        const source = Buffer.from(file.content).toString('utf8'); let match: RegExpExecArray | null;
        const pattern = /process\.env\.([A-Z_][A-Z0-9_]{0,63})|process\.env\[['"]([A-Z_][A-Z0-9_]{0,63})['"]\]/g;
        while ((match = pattern.exec(source))) names.add(match[1] || match[2]);
      }
      if (/\.py$/.test(file.path)) {
        const source = Buffer.from(file.content).toString('utf8'); let match: RegExpExecArray | null;
        const pattern = /os\.getenv\(\s*['"]([A-Z_][A-Z0-9_]{0,63})['"]|os\.environ(?:\.get\(\s*['"]([A-Z_][A-Z0-9_]{0,63})['"]|\[\s*['"]([A-Z_][A-Z0-9_]{0,63})['"]\s*\])/g;
        while ((match = pattern.exec(source))) names.add(match[1] || match[2] || match[3]);
      }
    }
    const existing = new Set(configured.map(item => item.key));
    return [...names].filter(key => !reservedEnvKeys.has(key)).sort().map(key => ({ key, configured:existing.has(key) }));
  }

  async create(actorId: string, botId: string, input: CreateEnvDto) {
    await this.authorize(actorId, botId); validateEnv(input.key, input.value);
    if (await this.prisma.envVariable.count({ where: { botId } }) >= 100) throw new BadRequestException('Limite de 100 variáveis por bot atingido');
    if (await this.prisma.envVariable.count({ where: { botId, key:input.key } })) throw new ConflictException('Já existe uma variável com este nome');
    const encrypted = this.crypto.encrypt(botId, input.key, input.value);
    const variable = await this.prisma.envVariable.create({ data: { botId,key:input.key,isSecret:input.isSecret,...encrypted }, select: { id:true,key:true,isSecret:true,createdAt:true,updatedAt:true } });
    await this.audit(actorId, 'BOT_ENV_CREATED', botId, input.key); await this.restart(botId,Boolean(input.restart)); return { ...variable,configured:true,maskedValue:'••••••••••••' };
  }

  async update(actorId: string, botId: string, variableId: string, input: UpdateEnvDto) {
    await this.authorize(actorId, botId); const current = await this.prisma.envVariable.findFirst({ where: { id:variableId,botId } }); if (!current) throw new NotFoundException('Variável não encontrada');
    const key = input.key || current.key; if (!envKeyPattern.test(key) || reservedEnvKeys.has(key)) throw new BadRequestException('Nome de variável inválido ou reservado');
    if (key !== current.key && await this.prisma.envVariable.count({ where: { botId,key } })) throw new ConflictException('Já existe uma variável com este nome');
    const data: any = { key, isSecret:input.isSecret ?? current.isSecret };
    if (input.value !== undefined && input.value !== '') { validateEnv(key,input.value); Object.assign(data,this.crypto.encrypt(botId,key,input.value)); }
    else if (key !== current.key) { const value=this.crypto.decrypt(botId,current.key,current); Object.assign(data,this.crypto.encrypt(botId,key,value)); }
    const variable=await this.prisma.envVariable.update({ where:{id:variableId},data,select:{id:true,key:true,isSecret:true,createdAt:true,updatedAt:true} });await this.audit(actorId,'BOT_ENV_UPDATED',botId,key);await this.restart(botId,Boolean(input.restart));return{...variable,configured:true,maskedValue:'••••••••••••'};
  }

  async remove(actorId:string,botId:string,variableId:string,restart=false){await this.authorize(actorId,botId);const variable=await this.prisma.envVariable.findFirst({where:{id:variableId,botId},select:{id:true,key:true}});if(!variable)throw new NotFoundException('Variável não encontrada');await this.prisma.envVariable.delete({where:{id:variable.id}});await this.audit(actorId,'BOT_ENV_DELETED',botId,variable.key);await this.restart(botId,restart);return{success:true}}

  async bulk(actorId:string,botId:string,content:string,isSecret:boolean,restart=false){await this.authorize(actorId,botId);const entries=parseEnv(content);const existing=await this.prisma.envVariable.findMany({where:{botId},select:{id:true,key:true}});const byKey=new Map(existing.map(item=>[item.key,item]));if(new Set([...byKey.keys(),...entries.map(item=>item.key)]).size>100)throw new BadRequestException('O lote ultrapassa o limite de 100 variáveis');for(const entry of entries)validateEnv(entry.key,entry.value);await this.prisma.$transaction(entries.map(entry=>{const encrypted=this.crypto.encrypt(botId,entry.key,entry.value),current=byKey.get(entry.key);return current?this.prisma.envVariable.update({where:{id:current.id},data:{...encrypted,isSecret}}):this.prisma.envVariable.create({data:{botId,key:entry.key,...encrypted,isSecret}})}));for(const entry of entries)await this.audit(actorId,byKey.has(entry.key)?'BOT_ENV_UPDATED':'BOT_ENV_CREATED',botId,entry.key);await this.restart(botId,restart);return{success:true,imported:entries.length}}

  async importLegacy(actorId:string,botId:string,confirm:boolean,restart=false){await this.authorize(actorId,botId);if(!confirm)throw new BadRequestException('Confirme a importação do arquivo .env');const legacy=await this.prisma.botFile.findUnique({where:{botId_path:{botId,path:'.env'}}});if(!legacy)throw new NotFoundException('Arquivo .env legado não encontrado');const result=await this.bulk(actorId,botId,Buffer.from(legacy.content).toString('utf8'),true,false);await this.prisma.botFile.delete({where:{id:legacy.id}});await this.audit(actorId,'BOT_ENV_LEGACY_IMPORTED',botId,'arquivo .env');await this.restart(botId,restart);return result}

  async resolvedForRunner(botId:string){const variables=await this.prisma.envVariable.findMany({where:{botId},select:{key:true,encryptedValue:true,iv:true,authTag:true,keyVersion:true}});return variables.map(variable=>({key:variable.key,value:this.crypto.decrypt(botId,variable.key,variable)}))}

  private async authorize(actorId:string,botId:string){const actor=await this.prisma.user.findUnique({where:{id:actorId},select:{role:true,status:true}});if(!actor||actor.status!=='ACTIVE')throw new ForbiddenException();const bot=await this.prisma.bot.findUnique({where:{id:botId},select:{id:true,userId:true}});if(!bot||bot.userId!==actorId&&actor.role!=='ADMIN')throw new NotFoundException('Bot não encontrado');return bot}
  private audit(actorUserId:string,action:string,botId:string,key:string){return this.prisma.auditLog.create({data:{actorUserId,action,targetType:'BOT_ENV',targetId:botId,after:{key}}})}
  private async restart(botId:string,requested:boolean){if(!requested)return;const bot=await this.prisma.bot.findUnique({where:{id:botId},select:{nodeId:true,status:true}});if(!bot?.nodeId)return;const active=await this.prisma.agentJob.count({where:{botId,status:{in:['QUEUED','RUNNING']}}});if(!active){await this.prisma.agentJob.create({data:{nodeId:bot.nodeId,botId,action:'DEPLOY'}});await this.prisma.bot.update({where:{id:botId},data:{status:'STARTING'}})}}
}
