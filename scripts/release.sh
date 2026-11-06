#!/usr/bin/env bash
# Release one plugin: bump version, build, test, scan, publish to npm, commit, tag, push.
# Usage: scripts/release.sh <plugin-dir> [patch|minor|major|x.y.z]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLUGIN="${1:-}"
BUMP="${2:-patch}"
BRANCH="main"

if [ -z "$PLUGIN" ] || [ ! -f "$ROOT/$PLUGIN/package.json" ]; then
  echo "Usage: $0 <plugin> [patch|minor|major|x.y.z]"
  echo "Plugins:"; for d in "$ROOT"/*/package.json; do echo "  $(basename "$(dirname "$d")")"; done
  exit 1
fi

cd "$ROOT"
if [ -n "$(git status --porcelain)" ]; then
  echo "Error: working tree must be clean before releasing"; git status --short; exit 1
fi
if [ "$(git rev-parse --abbrev-ref HEAD)" != "$BRANCH" ]; then
  echo "Error: release from '$BRANCH'"; exit 1
fi

cd "$ROOT/$PLUGIN"
npm version "$BUMP" --no-git-tag-version >/dev/null
NAME="$(node -p "require('./package.json').name")"
VER="$(node -p "require('./package.json').version")"
TAG="$PLUGIN-v$VER"
echo "==> $NAME@$VER"

echo "==> Build + test"
npm run build
npm test

echo "==> Leak scan"
if git -C "$ROOT" ls-files -co --exclude-standard "$PLUGIN" | grep -v package-lock.json \
  | xargs grep -nIE '/home/|/Users/|sk-[A-Za-z0-9]{16}|ghp_[A-Za-z0-9]{20}|BEGIN (RSA|OPENSSH)' 2>/dev/null; then
  echo "Error: possible private data above; aborting (version bump left uncommitted)"; exit 1
fi

echo "==> Pack preview"
npm pack --dry-run 2>&1 | tail -n 8

echo "==> Publish"
OTP="${NPM_OTP:-}"
if [ -z "$OTP" ] && [ -r /dev/tty ]; then
  read -rp "npm OTP (empty if not needed): " OTP < /dev/tty
fi
npm publish --access public ${OTP:+--otp="$OTP"}

cd "$ROOT"
git add "$PLUGIN"
git commit -m "$PLUGIN: v$VER"
git tag "$TAG"
git push origin "$BRANCH" "$TAG"

echo "==> Released $NAME@$VER ($TAG, $(git rev-parse --short HEAD))"
