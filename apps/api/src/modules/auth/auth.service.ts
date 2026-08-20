import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from './auth.dto';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}
  async setupStatus() { return { needsAdmin: (await this.prisma.user.count()) === 0 }; }
  async createFirstAdmin(input: RegisterDto) {
    if (await this.prisma.user.count()) throw new ConflictException('O administrador inicial já foi criado');
    return this.createUser(input, 'ADMIN');
  }
  async register(input: RegisterDto) { return this.createUser(input, 'USER'); }
  private async createUser(input: RegisterDto, role: 'USER' | 'ADMIN') {
    const email = input.email.trim().toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } })) throw new ConflictException('Este e-mail já está cadastrado');
    const user = await this.prisma.user.create({ data: { email, displayName: input.displayName.trim(), passwordHash: await hash(input.password, 12), role } });
    return this.session(user);
  }
  async login(input: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: input.email.trim().toLowerCase() } });
    if (!user?.passwordHash || user.status !== 'ACTIVE' || !(await compare(input.password, user.passwordHash))) throw new UnauthorizedException('E-mail ou senha inválidos');
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return this.session(user);
  }
  private async session(user: { id: string; email: string; displayName: string; role: 'USER' | 'ADMIN' }) {
    const token = await this.jwt.signAsync({ sub: user.id, email: user.email, role: user.role });
    return { token, user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role } };
  }
  async me(id: string) {
    return this.prisma.user.findUniqueOrThrow({ where: { id }, select: { id: true, email: true, displayName: true, avatarUrl: true, role: true, status: true } });
  }
  async limits(id:string){const limit=await this.prisma.resourceLimit.findFirst({where:{scope:'USER',userId:id}});return limit?{maxBots:limit.maxBots??5,cpuMillicores:limit.cpuMillicores,memoryMb:limit.memoryMb,diskMb:limit.diskMb.toString(),bandwidthIngressMb:limit.bandwidthIngressMb.toString(),bandwidthEgressMb:limit.bandwidthEgressMb.toString(),pidsLimit:limit.pidsLimit,maxUploadMb:limit.maxUploadMb}:{maxBots:5,cpuMillicores:250,memoryMb:256,diskMb:'1024',bandwidthIngressMb:'10240',bandwidthEgressMb:'10240',pidsLimit:100,maxUploadMb:100}}
}
