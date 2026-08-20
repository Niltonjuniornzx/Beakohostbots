import { BadRequestException } from '@nestjs/common';
import { envKeyPattern } from './env.dto';

export const reservedEnvKeys = new Set(['PATH','HOME','HOSTNAME','LD_PRELOAD','LD_LIBRARY_PATH','DOCKER_HOST','PYTHONPATH','NODE_OPTIONS','BASH_ENV','ENV','IFS','BEAKO_BOT_ID','BEAKO_NODE_ID']);
export type ParsedEnv = { key:string; value:string };

export function validateEnv(key:string,value:string) {
  if (!envKeyPattern.test(key) || reservedEnvKeys.has(key)) throw new BadRequestException('Nome de variável inválido ou reservado');
  if (Buffer.byteLength(value) > 16384) throw new BadRequestException('Valor maior que 16 KB');
  if (value.includes('\0') || value.includes('\r') || value.includes('\n')) throw new BadRequestException('O valor não pode conter bytes nulos ou quebras de linha');
}

export function parseEnv(content:string):ParsedEnv[] {
  if (content.includes('\0')) throw new BadRequestException('Arquivo .env contém byte nulo');
  const entries:ParsedEnv[]=[];
  for (const raw of content.split(/\r?\n/)) {
    const line=raw.trim(); if (!line || line.startsWith('#')) continue;
    const clean=line.startsWith('export ')?line.slice(7).trim():line,index=clean.indexOf('=');
    if (index<1) throw new BadRequestException('Linha inválida no formato .env');
    const key=clean.slice(0,index).trim(); let value=clean.slice(index+1);
    if ((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'"))) value=value.slice(1,-1);
    validateEnv(key,value); entries.push({key,value});
  }
  if (!entries.length) throw new BadRequestException('Nenhuma variável válida encontrada');
  if (new Set(entries.map(item=>item.key)).size!==entries.length) throw new BadRequestException('O lote contém nomes duplicados');
  return entries;
}
