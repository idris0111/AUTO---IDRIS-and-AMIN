#!/usr/bin/env bash
# Initial deployment only. Never overwrites an existing store or another site.
# Arguments: archive, archive SHA256, release Git SHA, public catalog JSON.
set -euo pipefail
umask 077
archive=$1
expected_sha=$2
release_sha=$3
catalog=$4
[[ $(id -u) == 0 ]] || { echo 'Run through sudo' >&2; exit 1; }
[[ $release_sha =~ ^[a-f0-9]{40}$ ]] || exit 1
[[ $expected_sha =~ ^[a-f0-9]{64}$ ]] || exit 1
[[ -f $archive && -f $catalog ]] || exit 1
for destination in /srv/zapchast /etc/zapchast /etc/systemd/system/zapchast-api.service /etc/nginx/sites-available/zapchast.king.tj /etc/nginx/sites-enabled/zapchast.king.tj /etc/nginx/snippets/zapchast-proxy.conf; do
    [[ ! -e $destination && ! -L $destination ]] || { echo "Already exists: $destination" >&2; exit 1; }
done
! getent passwd zapchast >/dev/null || { echo 'Account already exists' >&2; exit 1; }
[[ $(runuser -u postgres -- psql -X -Atc "select count(*) from pg_database where datname='zapchast'") == 0 ]] || exit 1
[[ $(runuser -u postgres -- psql -X -Atc "select count(*) from pg_roles where rolname='zapchast'") == 0 ]] || exit 1
! ss -lntH '( sport = :9157 )' | grep -q . || { echo 'Port 9157 is occupied' >&2; exit 1; }
[[ $(getent ahostsv4 zapchast.king.tj | awk '{print $1}' | sort -u) == 31.25.238.204 ]] || { echo 'Domain A does not match VPS' >&2; exit 1; }
printf '%s  %s\n' "$expected_sha" "$archive" | sha256sum --check
nginx -t
backup=/var/backups/zapchast-bootstrap-$release_sha
[[ ! -e $backup ]] || exit 1
install -d -m 0700 "$backup"
tar -czf "$backup/nginx-before.tar.gz" -C /etc nginx
systemctl list-units --type=service --state=running --no-legend > "$backup/services-before.txt"
ss -lnt > "$backup/ports-before.txt"

# New, dedicated swap unit; no fstab changes and no restart of another project.
if [[ $(awk '/SwapTotal:/ {print $2}' /proc/meminfo) == 0 ]]; then
    [[ ! -e /var/lib/zapchast && ! -e /etc/systemd/system/var-lib-zapchast-swapfile.swap ]] || exit 1
    install -d -m 0700 /var/lib/zapchast
    fallocate -l 1G /var/lib/zapchast/swapfile
    chmod 0600 /var/lib/zapchast/swapfile
    mkswap /var/lib/zapchast/swapfile
    cat > /etc/systemd/system/var-lib-zapchast-swapfile.swap <<'SWAPUNIT'
[Unit]
Description=Swap reserve for Zapchast deployment
[Swap]
What=/var/lib/zapchast/swapfile
[Install]
WantedBy=swap.target
SWAPUNIT
    systemctl daemon-reload
    systemctl enable --now var-lib-zapchast-swapfile.swap
fi

adduser --system --group --home /srv/zapchast --no-create-home zapchast
install -d -m 0755 /srv/zapchast /srv/zapchast/releases
release=/srv/zapchast/releases/$release_sha
install -d -m 0755 "$release"
tar -xzf "$archive" -C "$release" --no-same-owner --no-same-permissions
find "$release" -type d -exec chmod 0755 {} +
find "$release" -type f -exec chmod 0644 {} +
python3 -m venv "$release/backend/.venv"
"$release/backend/.venv/bin/python" -m pip install --disable-pip-version-check --no-cache-dir --only-binary=:all: -r "$release/backend/requirements.txt"

runuser -u postgres -- createuser --no-superuser --no-createdb --no-createrole zapchast
runuser -u postgres -- createdb --owner=zapchast --template=template0 --encoding=UTF8 --locale-provider=icu --icu-locale=ru-TJ zapchast
runuser -u zapchast -- psql -X -d zapchast -Atc "select current_user, lower('Истаравшан') = 'истаравшан'"
install -d -m 0700 /etc/zapchast
python3 - "$release/deploy/production.env.example" <<'ENVFILE'
from pathlib import Path
import secrets
import sys
template = Path(sys.argv[1]).read_text()
placeholder = 'replace-with-at-least-32-random-characters'
assert template.count(placeholder) == 1
Path('/etc/zapchast/backend.env').write_text(template.replace(placeholder, secrets.token_urlsafe(64)))
Path('/etc/zapchast/backend.env').chmod(0o600)
Path('/etc/zapchast/admin-initial-password').write_text(secrets.token_urlsafe(24) + '\n')
Path('/etc/zapchast/admin-initial-password').chmod(0o600)
ENVFILE
ln -s "$release" /srv/zapchast/current
run_app() {
    systemd-run --quiet --wait --pipe --collect -p User=zapchast -p Group=zapchast -p WorkingDirectory="$release/backend" -p EnvironmentFile=/etc/zapchast/backend.env "$@"
}
run_app "$release/backend/.venv/bin/python" -m alembic upgrade head
install -m 0640 -o root -g zapchast "$catalog" /srv/zapchast/catalog-initial.json
run_app "$release/backend/.venv/bin/python" "$release/deploy/scripts/catalog_snapshot.py" import /srv/zapchast/catalog-initial.json
cat /etc/zapchast/admin-initial-password | run_app "$release/backend/.venv/bin/python" "$release/deploy/scripts/bootstrap_admin.py" --email admin2@autouniverse.tj

install -d -m 0755 /usr/local/lib/zapchast
install -d -m 0700 -o postgres -g postgres /var/backups/zapchast
install -m 0755 "$release/deploy/scripts/backup-db.sh" /usr/local/lib/zapchast/backup-db.sh
install -m 0644 "$release/deploy/systemd/zapchast-backup.service" /etc/systemd/system/zapchast-backup.service
install -m 0644 "$release/deploy/systemd/zapchast-backup.timer" /etc/systemd/system/zapchast-backup.timer
systemctl daemon-reload
systemctl enable --now zapchast-backup.timer
systemctl start zapchast-backup.service

install -m 0644 "$release/deploy/systemd/zapchast-api.service" /etc/systemd/system/zapchast-api.service
systemctl daemon-reload
systemctl enable --now zapchast-api
ready=0
for attempt in $(seq 1 15); do
    if curl --silent --fail http://127.0.0.1:9157/ready; then ready=1; break; fi
    sleep 1
done
[[ $ready == 1 ]] || { journalctl -u zapchast-api -n 30 --no-pager; exit 1; }

install -d -m 0755 /var/www/zapchast-acme
install -m 0644 "$release/deploy/nginx/proxy.conf" /etc/nginx/snippets/zapchast-proxy.conf
install -m 0644 "$release/deploy/nginx/zapchast.conf" /etc/nginx/sites-available/zapchast.king.tj
ln -s /etc/nginx/sites-available/zapchast.king.tj /etc/nginx/sites-enabled/zapchast.king.tj
if ! nginx -t; then unlink /etc/nginx/sites-enabled/zapchast.king.tj; exit 1; fi
systemctl reload nginx
curl --fail --silent --resolve zapchast.king.tj:80:127.0.0.1 http://zapchast.king.tj/ready
certbot certonly --webroot --webroot-path /var/www/zapchast-acme --domain zapchast.king.tj --non-interactive --agree-tos --keep-until-expiring --deploy-hook '/usr/sbin/nginx -t && /bin/systemctl reload nginx'
cp /etc/nginx/sites-available/zapchast.king.tj "$backup/zapchast-http-bootstrap.conf"
install -m 0644 "$release/deploy/nginx/zapchast-https.conf" /etc/nginx/sites-available/zapchast.king.tj
if ! nginx -t; then cp "$backup/zapchast-http-bootstrap.conf" /etc/nginx/sites-available/zapchast.king.tj; exit 1; fi
systemctl reload nginx
curl --fail --silent --resolve zapchast.king.tj:443:127.0.0.1 https://zapchast.king.tj/ready
if ! systemctl is-active --quiet certbot.timer; then
    install -m 0644 "$release/deploy/systemd/zapchast-renew.service" /etc/systemd/system/zapchast-renew.service
    install -m 0644 "$release/deploy/systemd/zapchast-renew.timer" /etc/systemd/system/zapchast-renew.timer
    systemctl daemon-reload
    systemctl enable --now zapchast-renew.timer
fi
"$release/backend/.venv/bin/python" "$release/deploy/scripts/smoke.py" --base-url https://zapchast.king.tj
printf '\nDEPLOYED_RELEASE=%s\n' "$release_sha"
printf 'ADMIN_EMAIL=admin2@autouniverse.tj\n'
printf 'ADMIN_PASSWORD_FILE=/etc/zapchast/admin-initial-password (root only)\n'
free -m
