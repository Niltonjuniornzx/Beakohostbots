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

## Instalação fácil em VPS

Em Ubuntu 22.04/24.04 ou Debian 12:

```bash
git clone https://github.com/Niltonjuniornzx/Beakohostbots.git
cd Beakohostbots
sudo bash install.sh
```

O instalador pergunta o domínio, instala Docker, gera todos os segredos e inicia a stack. Depois use:

```bash
sudo beakoctl
```

O menu permite ver status/logs, reiniciar, atualizar e configurar domínio com HTTPS automático. Para repositório privado, clone usando uma chave SSH ou token de acesso do GitHub.

## Variáveis de ambiente dos bots

Use a aba **Variáveis** dentro de cada bot. Os valores são criptografados com AES-256-GCM e nunca voltam em texto aberto pela API. No Runner, eles existem somente em um arquivo temporário com permissão `0600` durante a criação do container; o arquivo é removido imediatamente depois.

O instalador cria a chave mestra em `/etc/beakohost/secrets/env-master-key`. Em uma atualização de instalação antiga, ele reaproveita automaticamente `ENCRYPTION_MASTER_KEY` para não invalidar dados já criptografados. Faça backup seguro desse arquivo: perdê-lo torna os valores armazenados irrecuperáveis.

## Estado

Esta primeira entrega contém a fundação executável: monorepo, painel, API, banco completo, contratos e agente com registro seguro. O roadmap está em `docs/ROADMAP.md`.
