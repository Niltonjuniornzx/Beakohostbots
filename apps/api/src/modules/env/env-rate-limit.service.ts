import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

@Injectable()
export class EnvRateLimitService {
  private readonly attempts = new Map<string, number[]>();
  check(identity: string, limit = 30, windowMs = 60_000) {
    const now = Date.now(), active = (this.attempts.get(identity) || []).filter(timestamp => now - timestamp < windowMs);
    if (active.length >= limit) throw new HttpException('Muitas alterações de variáveis. Aguarde um minuto.', HttpStatus.TOO_MANY_REQUESTS);
    active.push(now); this.attempts.set(identity, active);
  }
}
