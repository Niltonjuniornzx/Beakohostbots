# Baseline de segurança

- Proibidos: `--privileged`, socket Docker, host network/PID/IPC, dispositivos e bind mounts livres.
- Containers: `cap-drop=ALL`, `no-new-privileges`, seccomp, AppArmor, UID sem privilégios, limite de CPU/RAM/PIDs e `/tmp` em tmpfs.
- O daemon/agent nunca é publicado diretamente na internet.
- Segredos usam envelope encryption AES-256-GCM; a chave mestra fica fora do banco.
- Downloads e logs passam por autorização de dono/RBAC em toda requisição e WebSocket.
- ZIP é extraído em quarentena: sem caminhos absolutos, `..`, symlinks ou hardlinks; limites de entradas, bytes expandidos e taxa de compressão.
- `npm install`/`pip install` rodam em job efêmero sem segredos, com timeout, recursos e egress limitado.
- Credenciais SFTP são por bot, sem shell, com chroot virtual, Argon2id, cota e rate limit.
- Audit log é append-only para login, segredos, arquivos, bots, nós e ações administrativas.
- Backups são cifrados, testados e separados do servidor principal.

## Atenção

Container não é uma fronteira perfeita contra código hostil. Para planos públicos e desconhecidos, a evolução recomendada é gVisor/Kata ou microVMs, nós dedicados e egress deny-by-default.
