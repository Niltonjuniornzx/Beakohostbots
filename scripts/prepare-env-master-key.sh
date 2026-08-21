#!/usr/bin/env bash
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Execute como root para proteger a chave mestra." >&2
  exit 1
fi

secret_dir="${BEAKO_SECRET_DIR:-/etc/beakohost/secrets}"
secret_file="$secret_dir/env-master-key"
legacy_env_file="${1:-/opt/beakohost/.env}"
# GNU install resolves -g as a group name on some distributions, so a
# numeric container GID can fail on a brand-new host where that group is not
# registered. Create first, then use chown, which accepts numeric IDs.
install -d -m 0710 -o root "$secret_dir"
chown 0:1001 "$secret_dir"

if [ ! -s "$secret_file" ]; then
  umask 077
  legacy_key=""
  if [ -f "$legacy_env_file" ]; then
    legacy_key="$(sed -n 's/^ENCRYPTION_MASTER_KEY=//p' "$legacy_env_file" | head -n 1)"
  fi
  if [ -n "$legacy_key" ]; then
    printf '%s\n' "$legacy_key" > "$secret_file"
  else
    openssl rand -base64 32 > "$secret_file"
  fi
fi

chown 1001:1001 "$secret_file"
chmod 0600 "$secret_file"
echo "Chave mestra pronta em $secret_file"
