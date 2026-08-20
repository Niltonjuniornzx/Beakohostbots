import type { FastifyReply } from 'fastify';

export function setSessionCookie(reply: FastifyReply, token: string) {
  reply.setCookie('beako_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' && process.env.PUBLIC_URL?.startsWith('https://'),
    sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7,
  });
}
