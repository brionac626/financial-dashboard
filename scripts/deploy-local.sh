#!/usr/bin/env bash
set -euo pipefail

port=8788
if (( $# > 0 )); then
  if [[ $# != 2 || "$1" != '--port' || ! "$2" =~ ^[0-9]{4,5}$ ]]; then
    echo 'Usage: bash scripts/deploy-local.sh [--port 8788]' >&2
    exit 2
  fi
  port="$2"
  if (( 10#$port < 1024 || 10#$port > 65535 )); then echo 'Port must be between 1024 and 65535.' >&2; exit 2; fi
fi
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd -- "$script_dir/.."
if [[ ! -f node_modules/wrangler/bin/wrangler.js ]]; then
  echo 'Install dependencies first: npm ci --allow-remote=root' >&2
  exit 1
fi
npm run build
if [[ ! -f dist/index.html ]]; then echo 'Build did not produce dist/index.html.' >&2; exit 1; fi
printf 'Local Pages preview: http://127.0.0.1:%s\n' "$port"
node node_modules/wrangler/bin/wrangler.js pages dev dist --ip 127.0.0.1 --port "$port"
