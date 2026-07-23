#!/bin/sh
# Safe, repeatable first-run database bootstrap. Run from the ARTIFACT root:
#   cd ~/apps/orderweeddc/current && sh bootstrap-production-db.sh
#
# Guarantees:
#  - A timestamped backup is created whenever prod.db already exists.
#  - The verified schema template is installed ONLY when prod.db is absent,
#    zero bytes, or provably schema-empty (zero tables).
#  - A nonempty database with unknown contents is NEVER overwritten: the
#    script hard-stops and prints its table inventory instead.
#  - init (canonical org+brand) and the real ABCA seed run only after the
#    schema is proven present. Both are idempotent; rerunning is safe.
#  - No demo data. No secrets printed.
set -eu

APP_ROOT="$(cd "$(dirname "$0")" && pwd)"
DATA_DIR="${OWD_DATA_DIR:-$HOME/orderweeddc-data}"
DB="$DATA_DIR/prod.db"
TEMPLATE="$APP_ROOT/bootstrap/orderweeddc-schema-template.db"

# Node: CloudLinux selector path first, then PATH (local lifecycle tests).
NODE_BIN="${OWD_NODE:-/opt/alt/alt-nodejs20/root/usr/bin/node}"
[ -x "$NODE_BIN" ] || NODE_BIN="$(command -v node)" || {
  echo "HARD STOP: no usable node binary"; exit 1; }

# Prisma engine: CageFS hides os-release, so pin the bundled RHEL engine
# unless the operator already pinned one.
ENGINE="$APP_ROOT/node_modules/.prisma/client/libquery_engine-rhel-openssl-1.1.x.so.node"
if [ -z "${PRISMA_QUERY_ENGINE_LIBRARY:-}" ] && [ -f "$ENGINE" ]; then
  export PRISMA_QUERY_ENGINE_LIBRARY="$ENGINE"
fi
export DATABASE_URL="file:$DB"

[ -f "$TEMPLATE" ] || { echo "HARD STOP: schema template missing at $TEMPLATE"; exit 1; }
mkdir -p "$DATA_DIR"

install_template() {
  cp "$TEMPLATE" "$DB"
  chmod 600 "$DB"
  echo "schema template installed -> $DB"
}

if [ ! -f "$DB" ]; then
  echo "prod.db absent — installing schema template."
  install_template
else
  SIZE=$(wc -c < "$DB" | tr -d ' ')
  BACKUP="$DB.bak-$(date +%Y%m%d%H%M%S)"
  cp -p "$DB" "$BACKUP"
  echo "existing prod.db: ${SIZE} bytes — backup created: $BACKUP"
  if [ "$SIZE" -eq 0 ]; then
    echo "prod.db is zero bytes — installing schema template."
    install_template
  else
    INSPECT=$("$NODE_BIN" "$APP_ROOT/scripts/db-inspect.mjs" 2>&1) || {
      echo "HARD STOP: existing prod.db is nonempty but unreadable as SQLite."
      echo "Inspector said: $INSPECT"
      echo "Backup preserved at $BACKUP. Manual review required."
      exit 1
    }
    echo "inventory: $INSPECT"
    TABLES=$(printf '%s' "$INSPECT" | sed -n 's/.*"tableCount":\([0-9]*\).*/\1/p')
    CORE=$(printf '%s' "$INSPECT" | grep -c '"coreTablesPresent":true' || true)
    if [ "${TABLES:-0}" -eq 0 ]; then
      echo "prod.db has zero tables (schema-empty) — installing schema template."
      install_template
    elif [ "$CORE" -eq 0 ]; then
      echo "HARD STOP: prod.db has tables but not the expected schema."
      echo "No verified migration path — refusing to overwrite. Backup: $BACKUP"
      exit 1
    else
      echo "expected schema already present — leaving database untouched."
    fi
  fi
fi

echo "--- init: canonical organization + brand (idempotent, demo-free) ---"
"$NODE_BIN" "$APP_ROOT/scripts/init-production-db.mjs"

echo "--- seed: official ABCA retailer universe (AWAITING_VERIFICATION) ---"
"$NODE_BIN" "$APP_ROOT/scripts/seed-abca-retailers.mjs" \
  --universe="$APP_ROOT/docs/competitive/dc-merchant-universe.json"

echo "--- verification receipt ---"
"$NODE_BIN" "$APP_ROOT/scripts/db-inspect.mjs" --assert-core

echo "--- bootstrap complete ---"
echo "verify next: canonicalBrands must be 1, demonstrationRetailers 0."
