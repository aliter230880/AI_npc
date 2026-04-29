#!/usr/bin/env sh
set -eu

ARCHIVE_NAME="web3-aliterra-deploy.tar.gz"

FILES="
Dockerfile.backend
Dockerfile.frontend
docker-compose.prod.yml
docker/Caddyfile.prod
docker/nginx/default.conf
backend/server.mjs
backend/.env.example
package.json
package-lock.json
src
.env.prod.example
PROD_DEPLOY_WEB3.md
DEPLOY_WEB3_ALITERRA.md
"

INCLUDE=""
for path in $FILES; do
  if [ -e "$path" ]; then
    INCLUDE="$INCLUDE $path"
  fi
done

tar \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='.DS_Store' \
  -czf "$ARCHIVE_NAME" \
  $INCLUDE

echo "Archive created: $ARCHIVE_NAME"
