import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBotDto } from './bots.dto';

@Injectable()
export class BotsService {
  constructor(private readonly prisma: PrismaService) {}
  list(userId: string) {
    return this.prisma.bot.findMany({ where: { userId }, include: { runtime: true, node: { select: { id: true, name: true, status: true } } }, orderBy: { createdAt: 'desc' } });
  }
  async get(userId: string, id: string) {
    const bot = await this.prisma.bot.findFirst({ where: { id, userId }, include: { runtime: true, node: true } });
    if (!bot) throw new NotFoundException('Bot não encontrado');
    return bot;
  }
  async create(userId: string, input: CreateBotDto) {
    const [limit,currentBots]=await Promise.all([this.prisma.resourceLimit.findFirst({where:{scope:'USER',userId}}),this.prisma.bot.count({where:{userId}})]);
    const maxBots=limit?.maxBots??5;
    if(currentBots>=maxBots)throw new BadRequestException(`Você atingiu o limite de ${maxBots} bot(s)`);
    if (input.language === 'NODEJS' && !['20', '22'].includes(input.version)) throw new BadRequestException('Versão Node.js inválida');
    if (input.language === 'PYTHON' && !['3.11', '3.12'].includes(input.version)) throw new BadRequestException('Versão Python inválida');
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
    return this.prisma.bot.create({ data: {
      userId, runtimeId: runtime.id, name: input.name.trim(), slug, entrypoint: input.entrypoint,
      startCommand: input.language === 'NODEJS' ? ['node', input.entrypoint] : ['python', input.entrypoint],
    }, include: { runtime: true } });
  }
}
