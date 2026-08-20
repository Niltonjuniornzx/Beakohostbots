# BeakoHost Bots

Plataforma SaaS multi-servidor para hospedar bots Node.js e Python em containers isolados.

## Arquitetura

- `apps/web`: painel Next.js com dashboard responsivo.
- `apps/api`: API NestJS, autenticação, RBAC, bots, servidores e WebSockets.
- `services/runner-agent`: agente Go executado nos nós de bots.
- `packages/database`: esquema Prisma/PostgreSQL.
- `infrastructure`: stack local e configurações operacionais.
- `docs`: arquitetura, segurança e prompt mestre do produto.

O painel **não guarda senhas root**. Um token descartável instala e registra o Runner Agent; depois disso, comunicação é feita com identidade própria do nó e mTLS.

## Desenvolvimento

Requisitos: Node.js 22+, pnpm 9+, Docker Compose e Go 1.23+.

```bash
cp .env.example .env
docker compose up -d postgres redis
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm dev
```

Painel: `http://localhost:3000`  
API: `http://localhost:3001/api/health`

## Estado

Esta primeira entrega contém a fundação executável: monorepo, painel, API, banco completo, contratos e agente com registro seguro. O roadmap está em `docs/ROADMAP.md`.
