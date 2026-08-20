#!/usr/bin/env bash
set -Eeuo pipefail

panel_url=""
enrollment_token=""
allow_insecure="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --panel) panel_url="${2:-}"; shift 2 ;;
    --token) enrollment_token="${2:-}"; shift 2 ;;
    --allow-insecure) allow_insecure="true"; shift ;;
    *) echo "Argumento desconhecido: $1" >&2; exit 2 ;;
  esac
done

if [[ ${EUID} -ne 0 ]]; then
  echo "Execute como root: sudo bash scripts/install-runner.sh ..." >&2
  exit 1
fi
if [[ -z "$panel_url" || -z "$enrollment_token" ]]; then
  echo "Uso: sudo bash scripts/install-runner.sh --panel https://painel.exemplo.com --token TOKEN" >&2
  exit 2
fi
if [[ "$panel_url" != https://* && "$allow_insecure" != "true" ]]; then
  echo "O painel precisa usar HTTPS. Para teste temporário em HTTP, acrescente --allow-insecure." >&2
  exit 2
fi
if [[ ! -f services/runner-agent/go.mod ]]; then
  echo "Execute este instalador a partir da raiz do repositório BeakoHost." >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update
    DEBIAN_FRONTEND=noninteractive apt-get install -y docker.io ca-certificates
    systemctl enable --now docker
  else
    echo "Docker não encontrado. Instale o Docker e execute novamente." >&2
    exit 1
  fi
fi

echo "[BeakoHost] Criando usuário e diretórios isolados..."
getent group beako-agent >/dev/null || groupadd --system beako-agent
id beako-agent >/dev/null 2>&1 || useradd --system --gid beako-agent --home-dir /srv/beakohost --shell /usr/sbin/nologin beako-agent
install -d -m 0750 -o beako-agent -g beako-agent /etc/beakohost /srv/beakohost /srv/beakohost/bots

echo "[BeakoHost] Compilando o Runner..."
build_dir="$(mktemp -d)"
trap 'rm -rf -- "$build_dir"' EXIT
docker run --rm \
  -v "$(pwd)/services/runner-agent:/src:ro" \
  -v "$build_dir:/out" \
  -w /src golang:1.23-alpine \
  sh -c 'CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/beako-runner .'
install -m 0755 "$build_dir/beako-runner" /usr/local/bin/beako-runner

echo "[BeakoHost] Registrando esta VPS no painel..."
runner_args=(--enroll --panel "$panel_url" --config /etc/beakohost/runner.json)
if [[ "$allow_insecure" == "true" ]]; then runner_args+=(--allow-insecure); fi
BEAKO_ENROLLMENT_TOKEN="$enrollment_token" runuser -u beako-agent -- /usr/local/bin/beako-runner "${runner_args[@]}"
chmod 0600 /etc/beakohost/runner.json
chown beako-agent:beako-agent /etc/beakohost/runner.json

install -m 0644 services/runner-agent/beako-runner.service /etc/systemd/system/beako-runner.service
systemctl daemon-reload
systemctl enable --now beako-runner

echo
echo "Runner conectado com sucesso."
echo "Status: systemctl status beako-runner"
echo "Logs:   journalctl -u beako-runner -f"
