#!/usr/bin/env bash
set -Eeuo pipefail
export PATH=/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin
test "$(id -u)" = 0
test "$(hostname -s)" = cv8226803
public_key_file="${1:?Pass a public SSH key file}"
helper_file="${2:?Pass reviewed deploy-govza-8226803 helper}"
test -f "$public_key_file"
test -f "$helper_file"
test "$(wc -l < "$public_key_file")" -eq 1
grep -Eq '^ssh-ed25519 [A-Za-z0-9+/]+={0,3}( .*)?$' "$public_key_file"
ssh-keygen -lf "$public_key_file" >/dev/null
bash -n "$helper_file"
id serviceagg-deploy >/dev/null 2>&1 || useradd --create-home --shell /bin/bash serviceagg-deploy
install -d -o serviceagg-deploy -g serviceagg-deploy -m 0700 /home/serviceagg-deploy/.ssh
install -d -o serviceagg-deploy -g serviceagg-deploy -m 0750 /home/serviceagg-deploy/incoming
install -o root -g root -m 0755 "$helper_file" /usr/local/sbin/deploy-govza-8226803
rule=$(mktemp)
trap 'rm -f "$rule"' EXIT
echo 'serviceagg-deploy ALL=(root) NOPASSWD: /usr/local/sbin/deploy-govza-8226803' > "$rule"
visudo -cf "$rule"
install -o root -g root -m 0440 "$rule" /etc/sudoers.d/govza-deploy
# Preserve existing authorized keys; add this exact key once.
authorization=/home/serviceagg-deploy/.ssh/authorized_keys
touch "$authorization"
if ! grep -Fq -- "$(cat "$public_key_file")" "$authorization"; then
  printf 'restrict %s\n' "$(cat "$public_key_file")" >> "$authorization"
fi
chown serviceagg-deploy:serviceagg-deploy "$authorization"
chmod 0600 "$authorization"
visudo -c
echo 'GOVZA_DEPLOY_ACCOUNT_READY'
