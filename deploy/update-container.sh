#!/usr/bin/env bash
set -euo pipefail
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

exec 9>/var/lock/codeform-update.lock
flock -n 9

app_dir=/opt/codeform
staging=$(mktemp -d /opt/codeform-stage.XXXXXX)
backup="${app_dir}.previous.$(date -u +%Y%m%dT%H%M%SZ)"
cleanup() {
  if [[ -n "$staging" && -d "$staging" ]]; then rm -rf "$staging"; fi
}
trap cleanup EXIT

# Retain server-local configuration and dependencies while building separately.
cp -a "$app_dir/." "$staging/"
tar -xzf /tmp/codeform-update.tar.gz -C "$staging"
cd "$staging"
if ! cmp -s package-lock.json "$app_dir/package-lock.json"; then
  /usr/local/bin/npm ci --no-audit --no-fund
fi
rm -rf dist .vinext
/usr/local/bin/npm run lint
/usr/local/bin/npm test
/usr/local/bin/npm run typecheck
expected_version=$(cat dist/client/version.json)
chown -R codeform:codeform "$staging"
# mktemp creates mode 0700; the service user must be able to enter the release.
chmod 0755 "$staging"
install -d -o codeform -g codeform -m 0750 /var/lib/codeform-analytics
install -o root -g root -m 0644 "$staging/deploy/codeform.service" /etc/systemd/system/codeform.service
install -o root -g root -m 0644 "$staging/deploy/codeform-analytics.service" /etc/systemd/system/codeform-analytics.service
systemctl daemon-reload

restore_previous() {
  local status=$?
  trap - ERR
  set +e
  if [[ -d "$backup" ]]; then
    systemctl stop codeform.service
    if [[ -d "$app_dir" ]]; then mv "$app_dir" "${backup}.failed"; fi
    mv "$backup" "$app_dir"
  fi
  systemctl start codeform-analytics.service || true
  systemctl start codeform.service
  exit "$status"
}
trap restore_previous ERR
systemctl stop codeform.service
systemctl stop codeform-analytics.service || true
mv "$app_dir" "$backup"
mv "$staging" "$app_dir"
staging=""
cd "$app_dir"
systemctl start codeform-analytics.service
systemctl start codeform.service

healthy=false
for attempt in {1..30}; do
  if systemctl is-active --quiet codeform.service &&
    systemctl is-active --quiet codeform-analytics.service &&
    [[ "$(curl -fsS --max-time 2 http://127.0.0.1:3000/version.json 2>/dev/null || true)" == "$expected_version" ]] &&
    curl -fsS --max-time 2 -o /dev/null http://127.0.0.1:3101/summary &&
    curl -fsS --max-time 2 -o /dev/null http://127.0.0.1:3000/; then
    healthy=true
    break
  fi
  sleep 1
done
[[ "$healthy" == true ]]
trap - ERR
printf 'Deployment healthy. Rollback copy retained at %s\n' "$backup"
