#!/bin/sh
# Environment evidence probe — run ONCE in the cPanel Terminal before the
# first deploy and paste the output back. Read-only: changes nothing.
#   sh probe.sh
echo "=== orderweeddc Namecheap environment probe ==="
echo "--- identity ---"
whoami; hostname; pwd
echo "--- os ---"
cat /etc/redhat-release 2>/dev/null || cat /etc/os-release 2>/dev/null | head -3
echo "--- default node ---"
command -v node && node -v || echo "no node on default PATH (normal: cPanel apps use the Node.js Selector)"
echo "--- cloudlinux node selector versions ---"
ls /opt/alt/ 2>/dev/null | grep -i node || echo "selector dirs not visible"
for d in /opt/alt/alt-nodejs*/root/usr/bin/node; do
  [ -x "$d" ] && printf '%s -> ' "$d" && "$d" -v
done 2>/dev/null
echo "--- openssl (prisma engine target) ---"
openssl version 2>/dev/null || echo "openssl not on PATH"
echo "--- memory / process limits ---"
ulimit -a 2>/dev/null | head -15
cat /usr/bin/lveinfo 2>/dev/null >/dev/null && echo "lveinfo present" || true
echo "--- home filesystem ---"
df -h "$HOME" 2>/dev/null | tail -1
echo "--- passenger ---"
passenger --version 2>/dev/null || echo "passenger CLI not on PATH (normal for cPanel; managed by Apache)"
echo "--- cron availability ---"
crontab -l >/dev/null 2>&1 && echo "crontab accessible" || echo "crontab check: $?"
echo "--- databases ---"
mysql --version 2>/dev/null || echo "mysql client not on PATH"
command -v psql >/dev/null 2>&1 && psql --version || echo "no postgresql client (expected: Namecheap shared has no PostgreSQL)"
echo "=== probe complete — paste this whole output back ==="
