# Arquitetura multi-servidor

## Control plane

O painel, API, PostgreSQL e Redis formam o control plane. Ele mantém estado desejado, usuários, permissões, limites, segredos cifrados e auditoria. Não monta o socket Docker.

## Execution plane

Cada VPS de bots é um nó. O administrador cria um nó no painel e recebe um token de registro de uso único com validade curta. Na VPS, executa um instalador auditável. O instalador:

1. cria `beako-agent` e `/srv/beakohost`;
2. instala Docker rootless/cgroup v2 e o agente;
3. troca o token por certificado próprio do nó;
4. apaga o token;
5. inicia heartbeat mTLS de saída para o painel.

O painel nunca solicita nem armazena a senha root. A conexão de saída também permite nós atrás de NAT. Para o MVP, o agent HTTP implementado é apenas a fundação local; mTLS e fila de comandos são bloqueadores antes de produção.

## Diretórios

Cada bot recebe `/srv/beakohost/bots/<bot-id>/{app,data,tmp}`. O agente gera o caminho a partir do UUID validado. Caminhos enviados pelo cliente nunca são usados como caminhos do host.

## Scheduler

O scheduler filtra nós ONLINE, compatíveis com o runtime e abaixo de 80% de capacidade reservada. Depois escolhe o nó com maior memória disponível. Recursos são reservados na transação antes do comando de criação.

## Confiança

- Web/API não são confiados com Docker.
- Runner aceita apenas comandos tipados e imagens allowlisted.
- Bot é código hostil: sem capabilities, usuário não-root, filesystem read-only e rede controlada.
- Instalação de dependências acontece sem segredos em container efêmero.
