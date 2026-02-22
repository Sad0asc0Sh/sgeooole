#!/usr/bin/env bash
set -euo pipefail

# Redeploy helper for Ubuntu servers (safe + repeatable).
# - Resets the repo to a git ref (default: origin/main)
# - Installs dependencies for root/backend/frontend/admin (uses lockfiles)
# - Builds frontend + admin
# - Reloads PM2 (if available)
#
# Usage:
#   bash deploy/redeploy.sh
#   bash deploy/redeploy.sh origin/main
#   bash deploy/redeploy.sh <commit_sha_or_tag>

REF="${1:-origin/main}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "==> Git update ($REF)"
git fetch origin --prune
git reset --hard "$REF"

echo "==> Install deps (root)"
npm ci --include=dev

echo "==> Install deps (backend/frontend/admin)"
npm run install:all

echo "==> Build (frontend + admin)"
npm run build

if command -v pm2 >/dev/null 2>&1; then
  echo "==> PM2 reload"
  pm2 reload ecosystem.config.js --env production || pm2 start ecosystem.config.js --env production
fi

echo "Redeploy completed."
