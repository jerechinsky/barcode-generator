#!/usr/bin/env bash
set -euo pipefail
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends ca-certificates curl xz-utils

curl -fsSLo /tmp/node-v22.23.2-linux-x64.tar.xz \
  https://nodejs.org/dist/v22.23.2/node-v22.23.2-linux-x64.tar.xz
echo "d60acfe00a2932254bb0ad20e01b0d74397a0875595de719654b214f4b03f307  /tmp/node-v22.23.2-linux-x64.tar.xz" \
  | sha256sum --check
tar -xJf /tmp/node-v22.23.2-linux-x64.tar.xz -C /usr/local --strip-components=1
rm -f /tmp/node-v22.23.2-linux-x64.tar.xz

install -d -m 0755 /opt/codeform
tar -xzf /tmp/codeform.tar.gz -C /opt/codeform
cd /opt/codeform
if [[ ! -f dist/server/index.js ]]; then
  /usr/local/bin/npm ci --no-audit --no-fund
  /usr/local/bin/npm run build
fi

if ! id codeform >/dev/null 2>&1; then
  useradd --system --home-dir /opt/codeform --shell /usr/sbin/nologin codeform
fi
install -d -o codeform -g codeform -m 0755 /opt/codeform/.wrangler
install -d -o codeform -g codeform -m 0750 /var/lib/codeform-analytics
chown -R codeform:codeform /opt/codeform
install -o root -g root -m 0644 /tmp/codeform.service /etc/systemd/system/codeform.service
install -o root -g root -m 0644 /opt/codeform/deploy/codeform-analytics.service /etc/systemd/system/codeform-analytics.service

systemctl daemon-reload
systemctl enable --now codeform-analytics.service
systemctl enable --now codeform.service
