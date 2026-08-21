#!/usr/bin/env bash
set -Eeuo pipefail

readonly REPOSITORY_URL="${BEAKO_REPOSITORY_URL:-https://github.com/Niltonjuniornzx/Beakohostbots.git}"
readonly REPOSITORY_REF="${BEAKO_REPOSITORY_REF:-main}"

if [[ ${EUID} -ne 0 ]]; then
  echo "Execute como root: curl ... | sudo bash -s -- --panel URL --token TOKEN" >&2
  exit 1
fi

if [[ ! -f /etc/os-release ]]; then
  echo "Sistema não reconhecido. Use Ubuntu 22.04/24.04 ou Debian 12." >&2
  exit 1
fi
. /etc/os-release
case "${ID:-}" in
  ubuntu|debian) ;;
  *) echo "Sistema suportado: Ubuntu ou Debian." >&2; exit 1 ;;
esac

echo "[BeakoHost] Preparando instalação automática do Runner..."
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates git

work_dir="$(mktemp -d)"
cleanup() { rm -rf -- "$work_dir"; }
trap cleanup EXIT

git clone --depth 1 --branch "$REPOSITORY_REF" "$REPOSITORY_URL" "$work_dir/Beakohostbots"
cd "$work_dir/Beakohostbots"
bash scripts/install-runner.sh "$@"

