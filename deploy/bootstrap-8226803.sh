#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
test "$(id -u)" = 0
test "$(hostname -s)" = cv8226803
cd /opt/govza
export PATH=/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin
node -v
test "$(node -p 'process.versions.node.split(".")[0]')" = 22
if ! swapon --show | grep -q .; then
  if [ ! -e /swapfile ]; then
    fallocate -l 1G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
  fi
fi
apt-get -o Dir::Etc::sourceparts=- update
DEBIAN_FRONTEND=noninteractive apt-get install -y nginx postgresql postgresql-contrib certbot python3-certbot-nginx
systemctl enable --now postgresql nginx
id serviceagg >/dev/null 2>&1 || useradd --create-home --shell /bin/bash serviceagg
install -d -m 0750 -o root -g serviceagg /etc/service-aggregator
if [ -e /etc/service-aggregator/app.env ]; then
  echo 'Existing environment found; refusing new-database bootstrap.' >&2
  exit 1
fi
if sudo -u postgres psql -Atc "SELECT datname FROM pg_database WHERE datname='govza'" | grep -q govza; then
  echo 'Database already exists; refusing initialization.' >&2
  exit 1
fi
db_password=$(openssl rand -hex 24)
session_secret=$(openssl rand -hex 48)
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE USER serviceagg WITH PASSWORD '$db_password'"
sudo -u postgres createdb -O serviceagg govza
cat > /etc/service-aggregator/app.env <<EOF
NODE_ENV=production
PORT=8081
DATABASE_URL=postgresql://serviceagg:$db_password@127.0.0.1:5432/govza
SESSION_SECRET=$session_secret
EOF
chmod 0640 /etc/service-aggregator/app.env
chown root:serviceagg /etc/service-aggregator/app.env
unset db_password session_secret
set -a
. /etc/service-aggregator/app.env
set +a
npm ci --include=dev
NODE_OPTIONS=--max-old-space-size=1400 npm run check
NODE_OPTIONS=--max-old-space-size=1400 npm run build
npm run smoke:build
# Generate initial SQL, then apply only to the database created above.
test "$(sudo -u postgres psql -d govza -Atc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")" = 0
npx drizzle-kit generate --dialect postgresql --schema ./shared/database-schema.ts --out /root/govza-initial-schema
for migration in /root/govza-initial-schema/*.sql; do
  PGPASSWORD="$(node -e 'console.log(new URL(process.env.DATABASE_URL).password)')" psql -h 127.0.0.1 -U serviceagg -d govza -v ON_ERROR_STOP=1 --single-transaction -f "$migration"
done
chown -R serviceagg:serviceagg /opt/govza
ln -s /opt/govza /home/serviceagg/current
sed 's|ExecStart=/usr/bin/node|ExecStart=/usr/local/bin/node|' deploy/service-aggregator.service > /etc/systemd/system/service-aggregator.service
systemctl daemon-reload
systemctl enable --now service-aggregator
for attempt in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:8081/ -o /dev/null; then break; fi
  sleep 2
done
curl -fsS http://127.0.0.1:8081/ -o /dev/null
install -m 0644 deploy/nginx-service-aggregator.conf /etc/nginx/sites-available/govza
ln -s /etc/nginx/sites-available/govza /etc/nginx/sites-enabled/govza
nginx -t
systemctl reload nginx
curl -fsS -H 'Host: govza.pro' http://127.0.0.1/ -o /dev/null
systemctl is-active service-aggregator postgresql nginx
echo GOVZA_NEW_SERVER_READY
