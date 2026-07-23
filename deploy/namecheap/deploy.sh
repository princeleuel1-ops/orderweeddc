#!/bin/sh
# Server-side deploy: run in the cPanel Terminal AFTER uploading the
# artifact zip to ~/uploads/. Swaps the release with rollback safety.
#
#   sh ~/apps/orderweeddc/deploy.sh orderweeddc-<shortsha>.zip
#
# Layout it maintains:
#   ~/apps/orderweeddc/current    <- live release (cPanel app root)
#   ~/apps/orderweeddc/previous   <- last-known-good (rollback target)
#   ~/orderweeddc-data/prod.db    <- persistent database, NEVER touched here
set -eu

APP_HOME="$HOME/apps/orderweeddc"
UPLOADS="$HOME/uploads"
TAR_NAME="${1:?usage: deploy.sh <artifact-tar.gz-name in ~/uploads>}"
TAR_PATH="$UPLOADS/$TAR_NAME"

[ -f "$TAR_PATH" ] || { echo "ERROR: $TAR_PATH not found"; exit 1; }

STAGE="$APP_HOME/stage-$$"
mkdir -p "$APP_HOME" "$STAGE"
tar -xzf "$TAR_PATH" -C "$STAGE"

# The archive contains one directory: orderweeddc-<shortsha>/
RELEASE_DIR=$(find "$STAGE" -mindepth 1 -maxdepth 1 -type d | head -1)
[ -n "$RELEASE_DIR" ] || { echo "ERROR: archive did not contain a release directory"; exit 1; }
[ -f "$RELEASE_DIR/server.js" ] || { echo "ERROR: release missing server.js"; exit 1; }
[ -f "$RELEASE_DIR/receipt.json" ] || { echo "ERROR: release missing receipt.json"; exit 1; }

echo "Deploying release:"
grep -E '"(artifact|gitSha|builtAt)"' "$RELEASE_DIR/receipt.json" || true

# Preserve Passenger's restart directory expectations.
mkdir -p "$RELEASE_DIR/tmp"

# Swap: current -> previous (dropping the older previous), release -> current.
if [ -d "$APP_HOME/current" ]; then
  rm -rf "$APP_HOME/previous"
  mv "$APP_HOME/current" "$APP_HOME/previous"
fi
mv "$RELEASE_DIR" "$APP_HOME/current"
rmdir "$STAGE" 2>/dev/null || rm -rf "$STAGE"

# Passenger restart signal.
touch "$APP_HOME/current/tmp/restart.txt"

echo "Deployed. If this is the FIRST deploy, initialize the database:"
echo "  cd $APP_HOME/current && DATABASE_URL=file:$HOME/orderweeddc-data/prod.db \\"
echo "    node scripts/init-production-db.mjs && node scripts/seed-abca-retailers.mjs"
echo "Then verify:  curl -s https://orderweeddc.com/api/health"
