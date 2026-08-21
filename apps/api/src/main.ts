import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './modules/app.module';
import cookie from '@fastify/cookie';

// Prisma maps PostgreSQL BIGINT columns to JavaScript bigint. JSON.stringify,
// used by Fastify for every response, does not support bigint natively.
Object.defineProperty(BigInt.prototype, 'toJSON', {
  configurable: true,
  value(this: bigint) { return this.toString(); },
});

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter({ bodyLimit: 160 * 1024 * 1024 }));
  // Nest's Fastify adapter and @fastify/cookie can resolve separate copies of
  // Fastify's augmented types under pnpm. Runtime APIs are compatible.
  await app.register(cookie as any, { secret: process.env.JWT_SECRET });
  app.setGlobalPrefix('api');
  app.enableCors({ origin: process.env.WEB_URL ?? 'http://localhost:3000', credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 3001), '0.0.0.0');
}
void bootstrap();
