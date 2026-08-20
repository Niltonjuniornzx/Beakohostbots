#!/usr/bin/env bash
set -Eeuo pipefail

readonly INSTALL_DIR="/opt/beakohost"
readonly ENV_FILE="${INSTALL_DIR}/.env"
readonly SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

green='\033[0;32m'; yellow='\033[1;33m'; red='\033[0;31m'; reset='\033[0m'
info() { printf "${green}[BeakoHost]${reset} %s\n" "$*"; }
warn() { printf "${yellow}[Aviso]${reset} %s\n" "$*"; }
die() { printf "${red}[Erro]${reset} %s\n" "$*" >&2; exit 1; }

[[ ${EUID} -eq 0 ]] || die "Execute como root: sudo bash install.sh"
[[ -f "${SOURCE_DIR}/docker-compose.prod.yml" ]] || die "Execute este arquivo dentro da pasta do projeto."
command -v openssl >/dev/null || die "Instale openssl antes de continuar."

install_docker() {
  if command -v docker >/dev/null && docker compose version >/dev/null 2>&1; then return; fi
  [[ -f /etc/os-release ]] || die "Sistema não reconhecido. Use Ubuntu 22.04/24.04 ou Debian 12."
  . /etc/os-release
  case "${ID:-}" in ubuntu|debian) ;; *) die "Sistema suportado: Ubuntu ou Debian." ;; esac
  info "Instalando Docker e dependências..."
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl docker.io openssl rsync
  if ! apt-get install -y docker-compose-v2; then
    apt-get install -y docker-compose-plugin || die "Não foi possível instalar Docker Compose v2."
  fi
  systemctl enable --now docker
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
ENCRYPTION_MASTER_KEY=$(openssl rand -base64 32 | tr -d '\n')
AGENT_ENROLLMENT_SECRET=$(random_hex 48)
EOF
}

main() {
  clear || true
  printf '\n  BeakoHost Bots — Instalador do Painel\n  =====================================\n\n'
  read -r -p "Domínio do painel [localhost]: " domain
  domain="${domain:-localhost}"
  [[ "$domain" =~ ^([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+(:[0-9]+)?$ ]] || die "Domínio inválido. Informe somente host, sem http:// ou caminhos."
  install_docker
  check_network
  info "Copiando aplicação para ${INSTALL_DIR}..."
  mkdir -p "${INSTALL_DIR}"
  if [[ "${SOURCE_DIR}" != "${INSTALL_DIR}" ]]; then
    rsync -a --delete --exclude '.git' --exclude '.env' --exclude 'node_modules' "${SOURCE_DIR}/" "${INSTALL_DIR}/"
  fi
  [[ -f "${ENV_FILE}" ]] || write_env "$domain"
  install -m 0755 "${INSTALL_DIR}/scripts/beakoctl" /usr/local/bin/beakoctl
  info "Construindo e iniciando os serviços..."
  cd "${INSTALL_DIR}"
  docker compose --env-file .env -f docker-compose.prod.yml up -d --build
  printf '\n${green}Instalação concluída.${reset}\n'
  printf 'Painel: %s\n' "$(grep '^PUBLIC_URL=' .env | cut -d= -f2-)"
  printf 'Gerenciamento: sudo beakoctl\n\n'
  if [[ "$domain" != "localhost" ]]; then
    warn "Aponte os registros DNS A/AAAA de ${domain} para esta VPS. O HTTPS será ativado automaticamente."
  fi
}
main "$@"
