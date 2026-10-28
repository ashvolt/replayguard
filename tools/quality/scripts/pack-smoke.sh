#!/usr/bin/env bash
# Packs every publishable package and installs the tarballs into a fresh project, then checks
# ESM, CommonJS, TypeScript declarations (skipLibCheck: false) and the Vitest setup entry.
# Needs registry access for third-party dependencies. Run after `pnpm build`.
set -euo pipefail
root=$(cd "$(dirname "$0")/../../.." && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/tarballs" "$work/app"
for pkg in "$root"/packages/*/; do
	(cd "$pkg" && pnpm pack --pack-destination "$work/tarballs" >/dev/null)
done
# Only dist/, README.md, LICENSE and package.json may ship.
for t in "$work"/tarballs/*.tgz; do
	extra=$(tar -tzf "$t" | grep -vE '^package/(dist/.+|package\.json|README\.md|LICENSE)$' || true)
	if [ -n "$extra" ]; then echo "unexpected files in $(basename "$t"):"; echo "$extra"; exit 1; fi
done
cp "$root"/tools/quality/consumer/* "$work/app/"
cd "$work/app"
# --legacy-peer-deps avoids an npm arborist crash on rivetkit's peer set; peers are listed explicitly.
npm install --ignore-scripts --legacy-peer-deps --no-audit --no-fund --loglevel=error \
	"$work"/tarballs/*.tgz @rivet-dev/workflows@1.0.0 rivetkit@2.3.27 vitest@4.1.12 \
	typescript@6.0.3 @types/node@22.20.5
node esm.mjs
node cjs.cjs
npx tsc -p tsconfig.json && echo "types ok"
npx vitest run
