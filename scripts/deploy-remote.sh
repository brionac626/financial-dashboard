#!/usr/bin/env bash
set -euo pipefail

dry_run=false
case "${1:-}" in
  '') ;;
  --dry-run) dry_run=true ;;
  *) echo 'Usage: bash scripts/deploy-remote.sh [--dry-run]' >&2; exit 2 ;;
esac
if (( $# > 1 )); then echo 'Too many arguments.' >&2; exit 2; fi

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd -- "$script_dir/.."
if [[ ! -f node_modules/wrangler/bin/wrangler.js ]]; then
  echo 'Install dependencies first: npm ci --allow-remote=root' >&2
  exit 1
fi
project_name="$(node -e 'process.stdout.write(process.env.CLOUDFLARE_PROJECT_NAME || JSON.parse(require("node:fs").readFileSync("wrangler.jsonc", "utf8")).name)')"
if [[ ! "$project_name" =~ ^[a-z0-9][a-z0-9-]*$ ]]; then echo 'Invalid Cloudflare Pages project name.' >&2; exit 1; fi
if [[ "$dry_run" == false && ( -z "${CLOUDFLARE_API_TOKEN:-}" || -z "${CLOUDFLARE_ACCOUNT_ID:-}" ) ]]; then
  echo 'Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID before deploying.' >&2
  exit 1
fi
printf 'Target: %s | production branch: main\n' "$project_name"
npm test
npm run build
if [[ ! -f dist/index.html ]]; then echo 'Build did not produce dist/index.html.' >&2; exit 1; fi
printf 'Command: node node_modules/wrangler/bin/wrangler.js pages deploy dist --project-name %s --branch main\n' "$project_name"
if [[ "$dry_run" == true ]]; then
  echo 'Dry run completed. No Cloudflare request was made.'
  exit 0
fi
# Non-interactive mode fails for missing projects instead of offering creation.
CI=true node node_modules/wrangler/bin/wrangler.js pages deploy dist --project-name "$project_name" --branch main
echo 'Deployment completed. See the deployment URL returned by Wrangler above.'
