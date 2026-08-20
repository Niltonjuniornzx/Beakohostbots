# Roadmap

## Fase 1 — fundação

- [x] Monorepo, painel inicial, API, Prisma e agente.
- [x] Modelo multi-servidor sem senha root armazenada.
- [ ] Autenticação e-mail, Google e Discord.
- [ ] RBAC USER/ADMIN e sessões revogáveis.
- [ ] Cadastro/enrollment mTLS dos nós.
- [ ] CRUD de runtimes, bots e cotas.

## Fase 2 — execução MVP

- Scheduler, allowlist de imagens e Docker rootless.
- Start/stop/restart e crash-loop backoff.
- Logs WebSocket com autorização.
- Node 20/22 e Python 3.11/3.12 Alpine e Slim.
- Env vars AES-256-GCM.

## Fase 3 — arquivos

- Explorer + Monaco.
- Upload ZIP seguro e deployments atômicos.
- Jobs isolados `npm ci` e `pip install`.
- SFTPGo com credencial e cota por bot.

## Fase 4 — observabilidade e proteção

- cAdvisor/Prometheus, disco e tráfego por veth.
- Alertas, webhooks, e-mail, isolamento automático.
- AppArmor/seccomp customizados, scanner e retenção.

## Fase 5 — produto

- Planos, cobrança, backups, rollback e múltiplas regiões.
- Loki/objeto externo e scheduler com alta disponibilidade.
