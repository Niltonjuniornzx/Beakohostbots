#!/usr/bin/env bash
set -Eeuo pipefail

readonly INSTALL_DIR="/opt/beakohost"
readonly ENV_FILE="${INSTALL_DIR}/.env"
readonly SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

green='\033[0;32m'; yellow='\033[1;33m'; red='\033[0;31m'; reset='\033[0m'
info() { printf "${green}[BeakoHost]${reset} %s\n" "$*"; }
warn() { printf "${yellow}[Aviso]${reset} %s\n" "$*"; }
die() { printf "${red}[Erro]${reset} %s\n" "$*" >&2; exit 1; }
on_error() {
  local code=$? line=${BASH_LINENO[0]:-desconhecida}
  printf "\n${red}[Erro]${reset} Instalação interrompida na linha %s (código %s).\n" "$line" "$code" >&2
  printf 'Corrija a mensagem acima e execute o instalador novamente; dados existentes serão preservados.\n' >&2
  exit "$code"
}
trap on_error ERR

[[ ${EUID} -eq 0 ]] || die "Execute como root: sudo bash install.sh"
[[ -f "${SOURCE_DIR}/docker-compose.prod.yml" ]] || die "Execute este arquivo dentro da pasta do projeto."

install_dependencies() {
  [[ -f /etc/os-release ]] || die "Sistema não reconhecido. Use Ubuntu 22.04/24.04 ou Debian 12."
  . /etc/os-release
  case "${ID:-}" in ubuntu|debian) ;; *) die "Sistema suportado: Ubuntu ou Debian." ;; esac
  info "Preparando dependências do sistema..."
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl jq openssl rsync
  if ! command -v docker >/dev/null; then
    DEBIAN_FRONTEND=noninteractive apt-get install -y docker.io
  fi
  if ! docker compose version >/dev/null 2>&1; then
    if ! DEBIAN_FRONTEND=noninteractive apt-get install -y docker-compose-v2; then
      DEBIAN_FRONTEND=noninteractive apt-get install -y docker-compose-plugin || die "Não foi possível instalar Docker Compose v2."
    fi
  fi
  systemctl enable --now docker
  docker info >/dev/null 2>&1 || die "O serviço Docker não iniciou corretamente."
}

configure_docker_dns() {
  if docker run --rm busybox nslookup registry.npmjs.org >/dev/null 2>&1; then return 0; fi
  warn "O DNS interno do Docker não está respondendo. Aplicando correção segura..."
  mkdir -p /etc/docker
  local current='{}' temporary
  if [[ -s /etc/docker/daemon.json ]] && jq empty /etc/docker/daemon.json >/dev/null 2>&1; then
    current="$(cat /etc/docker/daemon.json)"
    cp -a /etc/docker/daemon.json "/etc/docker/daemon.json.backup.$(date +%Y%m%d%H%M%S)"
  fi
  temporary="$(mktemp)"
  printf '%s' "$current" | jq '. + {dns: ["1.1.1.1", "8.8.8.8"]}' >"$temporary"
  install -m 0644 "$temporary" /etc/docker/daemon.json
  rm -f "$temporary"
  systemctl restart docker
  sleep 3
  docker run --rm busybox nslookup registry.npmjs.org >/dev/null 2>&1 || die "O DNS do Docker continua indisponível. Backup salvo em /etc/docker/daemon.json.backup.*"
  info "DNS do Docker corrigido."
}

check_network() {
  info "Verificando acesso ao registro de dependências..."
  local attempt
  for attempt in 1 2 3 4 5; do
    if getent ahostsv4 registry.npmjs.org >/dev/null 2>&1; then return 0; fi
    warn "DNS ainda não respondeu (tentativa ${attempt}/5)..."
    sleep $((attempt * 3))
  done
  die "A VPS não conseguiu resolver registry.npmjs.org. Verifique o DNS/rede e execute novamente."
}

random_hex() { openssl rand -hex "$1"; }
write_env() {
  local domain="$1" caddy_domain="$1" public_url
  if [[ "$domain" == "localhost" ]]; then
    caddy_domain=":80"
    public_url="http://$(hostname -I 2>/dev/null | awk '{print $1}')"
    [[ "$public_url" != "http://" ]] || public_url="http://localhost"
  else
    public_url="https://${domain}"
  fi
  umask 077
  cat >"${ENV_FILE}" <<EOF
PANEL_DOMAIN=${caddy_domain}
PUBLIC_URL=${public_url}
POSTGRES_USER=beakohost
POSTGRES_PASSWORD=$(random_hex 24)
POSTGRES_DB=beakohost
REDIS_PASSWORD=$(random_hex 24)
JWT_SECRET=$(random_hex 48)
AGENT_ENROLLMENT_SECRET=$(random_hex 48)
EOF
}

main() {
  local requested_domain="${1:-}" domain existing_install=false
  clear || true
  printf '\n  BeakoHost Bots — Instalador do Painel\n  =====================================\n\n'
  if [[ -f "${ENV_FILE}" ]]; then
    existing_install=true
    domain="$(sed -n 's/^PUBLIC_URL=//p' "${ENV_FILE}" | head -n 1 | sed -E 's#^https?://##;s#/.*$##')"
    domain="${domain:-localhost}"
    info "Instalação existente detectada; configurações e dados serão preservados."
  else
    domain="$requested_domain"
    if [[ -z "$domain" ]]; then read -r -p "Domínio do painel [localhost]: " domain; fi
    domain="${domain:-localhost}"
    [[ "$domain" =~ ^([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+(:[0-9]+)?$ ]] || die "Domínio inválido. Informe somente host, sem http:// ou caminhos."
  fi
  install_dependencies
  check_network
  configure_docker_dns
  info "Copiando aplicação para ${INSTALL_DIR}..."
  mkdir -p "${INSTALL_DIR}"
  if [[ "${SOURCE_DIR}" != "${INSTALL_DIR}" ]]; then
    rsync -a --delete --exclude '.git' --exclude '.env' --exclude 'node_modules' "${SOURCE_DIR}/" "${INSTALL_DIR}/"
  fi
  [[ -f "${ENV_FILE}" ]] || write_env "$domain"
  bash "${INSTALL_DIR}/scripts/prepare-env-master-key.sh" "${ENV_FILE}"
  install -m 0755 "${INSTALL_DIR}/scripts/beakoctl" /usr/local/bin/beakoctl
  docker compose --env-file "${ENV_FILE}" -f "${INSTALL_DIR}/docker-compose.prod.yml" config --quiet || die "Configuração do Docker Compose inválida."
  info "Construindo e iniciando os serviços..."
  cd "${INSTALL_DIR}"
  docker compose --env-file .env -f docker-compose.prod.yml up -d --build
  info "Aguardando o painel ficar saudável..."
  local healthy=false attempt
  for attempt in $(seq 1 30); do
    if docker compose --env-file .env -f docker-compose.prod.yml exec -T api \
      node -e "fetch('http://127.0.0.1:3001/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))" >/dev/null 2>&1; then
      healthy=true
      break
    fi
    sleep 2
  done
  if [[ "$healthy" != "true" ]]; then
    docker compose --env-file .env -f docker-compose.prod.yml logs --tail=80 api >&2 || true
    die "A API não iniciou. Os últimos logs foram exibidos acima."
  fi
  printf "\n${green}Instalação concluída.${reset}\n"
  printf 'Painel: %s\n' "$(grep '^PUBLIC_URL=' .env | cut -d= -f2-)"
  printf 'Gerenciamento: sudo beakoctl\n\n'
  if [[ "$existing_install" != "true" && "$domain" != "localhost" ]]; then
    warn "Aponte os registros DNS A/AAAA de ${domain} para esta VPS. O HTTPS será ativado automaticamente."
  fi
}
main "$@"
