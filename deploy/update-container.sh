#!/usr/bin/env bash
set -euo pipefail
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

systemctl stop codeform.service

if [[ -d /opt/codeform/dist ]]; then
  mv /opt/codeform/dist /opt/codeform/dist.previous
fi
if [[ -d /opt/codeform/.vinext ]]; then
  mv /opt/codeform/.vinext /opt/codeform/.vinext.previous
fi

restore_previous() {
  rm -rf /opt/codeform/dist /opt/codeform/.vinext
  if [[ -d /opt/codeform/dist.previous ]]; then
    mv /opt/codeform/dist.previous /opt/codeform/dist
  fi
  if [[ -d /opt/codeform/.vinext.previous ]]; then
    mv /opt/codeform/.vinext.previous /opt/codeform/.vinext
  fi
  chown -R codeform:codeform /opt/codeform
  systemctl start codeform.service
}

trap restore_previous ERR
tar -xzf /tmp/codeform-update.tar.gz -C /opt/codeform
cd /opt/codeform
/usr/local/bin/npm run build
chown -R codeform:codeform /opt/codeform
rm -rf /opt/codeform/dist.previous /opt/codeform/.vinext.previous
systemctl start codeform.service
trap - ERR
