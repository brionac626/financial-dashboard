#!/usr/bin/env bash
set -euo pipefail
if (( $# > 1 )) || [[ "${1:-}" != '' && "${1:-}" != '--dry-run' ]]; then
  echo 'Usage: bash scripts/deploy-remote.sh [--dry-run]' >&2
  exit 2
fi
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
exec node "$script_dir/pages.mjs" deploy "$@"
