#!/bin/sh
# Restart the Passenger-managed app without redeploying:
#   sh ~/apps/orderweeddc/restart.sh
set -eu
APP_HOME="$HOME/apps/orderweeddc"
mkdir -p "$APP_HOME/current/tmp"
touch "$APP_HOME/current/tmp/restart.txt"
echo "Restart signaled. Verify:  curl -s https://orderweeddc.com/api/health"
