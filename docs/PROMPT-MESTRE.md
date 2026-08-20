# Prompt mestre — BeakoHost Bots

Atue como uma equipe sênior de arquitetura SaaS, segurança Linux, DevOps, backend, frontend e UX. Desenvolva a BeakoHost Bots, uma plataforma multi-tenant para hospedagem e gerenciamento de bots Node.js e Python.

## Princípios obrigatórios

1. Separar o control plane (web, API, banco, filas) do execution plane (nós Runner).
2. Nunca expor o Docker socket ao painel, containers ou internet.
3. Nunca pedir, transmitir ou armazenar senha root. O root pode ser usado manualmente apenas para instalar um agente local; o registro utiliza token descartável e, depois, mTLS.
4. Tratar todo código, ZIP, dependência e nome de arquivo do usuário como hostil.
5. Aplicar autorização de tenant em toda consulta, arquivo, log e conexão WebSocket.
6. Operações Docker devem ser tipadas, auditáveis e limitadas por allowlist; nunca aceitar comandos ou flags arbitrárias.

## Produto

- Login e-mail/senha, Google e Discord; USER e ADMIN.
- Bots Node/Python com versões Alpine e Slim fixadas por digest.
- Editor Monaco, upload ZIP seguro, SFTP por bot, dependências em job efêmero e segredos cifrados.
- Start/stop/restart, logs WebSocket, auto-restart com backoff e métricas de CPU/RAM/disco/rede.
- Admin gerencia usuários, nós, runtimes, cotas globais/individuais, alertas e ações automáticas.
- Nós são adicionados pelo painel por enrollment de uso único. O agente cria `/srv/beakohost/bots/<bot-id>` e isola cada bot.

## Critérios técnicos

- Next.js/TypeScript, NestJS/Fastify, PostgreSQL/Prisma, Redis/BullMQ e Runner Agent em Go.
- Docker rootless com cgroup v2; non-root, cap-drop ALL, no-new-privileges, seccomp/AppArmor, read-only rootfs, pids/memory/cpu/tmpfs.
- SFTPGo sem shell, com chroot virtual, cota, rate limit e credenciais revogáveis.
- ZIP: quarentena, prevenção de Zip Slip/ZIP bomb, sem symlink/hardlink e publicação atômica.
- Métricas por cAdvisor/Prometheus; tráfego fiscalizado no nó com tc/nftables/eBPF.
- Audit log e idempotência para operações críticas.

Implemente em fases pequenas e verificáveis. Não declare uma funcionalidade pronta sem testes. Em cada entrega apresente migrações, validações, testes, ameaças mitigadas e pendências reais. Priorize segurança e funcionamento sobre quantidade de telas.
