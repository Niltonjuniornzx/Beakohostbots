import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { readFileSync } from 'fs';

export type EncryptedPayload = { encryptedValue: Uint8Array<ArrayBuffer>; iv: Uint8Array<ArrayBuffer>; authTag: Uint8Array<ArrayBuffer>; keyVersion: number };

@Injectable()
export class EnvCryptoService {
  private readonly key: Buffer;
  readonly keyVersion = Number(process.env.ENV_MASTER_KEY_VERSION || 1);

  constructor() { this.key = this.loadKey(); }

  encrypt(botId: string, key: string, value: string): EncryptedPayload {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(this.aad(botId, key, this.keyVersion));
    const encryptedValue = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return { encryptedValue:Uint8Array.from(encryptedValue), iv:Uint8Array.from(iv), authTag:Uint8Array.from(cipher.getAuthTag()), keyVersion: this.keyVersion };
  }

  decrypt(botId: string, key: string, payload: EncryptedPayload): string {
    if (payload.keyVersion !== this.keyVersion) throw new InternalServerErrorException('Versão da chave mestra indisponível');
    const decipher = createDecipheriv('aes-256-gcm', this.key, payload.iv);
    decipher.setAAD(this.aad(botId, key, payload.keyVersion));
    decipher.setAuthTag(payload.authTag);
    return Buffer.concat([decipher.update(payload.encryptedValue), decipher.final()]).toString('utf8');
  }

  private aad(botId: string, key: string, version: number) { return Buffer.from(`beakohost-env:${version}:${botId}:${key}`); }

  private loadKey() {
    const file = process.env.ENV_MASTER_KEY_FILE || '/etc/beakohost/secrets/env-master-key';
    let raw = '';
    try { raw = readFileSync(file, 'utf8').trim(); } catch { raw = String(process.env.ENCRYPTION_MASTER_KEY || '').trim(); }
    const key = /^[a-f0-9]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
    if (key.length !== 32) throw new Error('A chave mestra de variáveis deve possuir exatamente 32 bytes');
    return key;
  }
}
