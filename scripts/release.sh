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
# Scan every publishable file (tracked + untracked, minus .gitignore) for paths
# and credentials. package-lock.json is included on purpose: the patterns are
# specific, so registry maintainer addresses don't trigger false positives.
#
# Private project names must NOT live in this public repo. Put one regex per
# line in an untracked file (default: ~/.config/opencode/leak-patterns.txt) or
# pass EXTRA_LEAK_PATTERN. That way the deny-list itself is never published.
EXTRA_LEAK_PATTERN="${EXTRA_LEAK_PATTERN:-}"
LOCAL_PATTERN_FILE="${LEAK_PATTERN_FILE:-$HOME/.config/opencode/leak-patterns.txt}"
if [ -z "$EXTRA_LEAK_PATTERN" ] && [ -r "$LOCAL_PATTERN_FILE" ]; then
  EXTRA_LEAK_PATTERN="$(tr '\n' '|' < "$LOCAL_PATTERN_FILE" | sed -e 's/|$//' -e 's/||*/|/g')"
fi
LEAK_PATTERN='/home/|/Users/|C:\\\\Users|sk-[A-Za-z0-9]{16}|gh[pousr]_[A-Za-z0-9]{20}|github_pat_|npm_[A-Za-z0-9]{36}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30}|xox[baprs]-|-----BEGIN [A-Z ]*PRIVATE KEY'
if [ -n "$EXTRA_LEAK_PATTERN" ]; then LEAK_PATTERN="$LEAK_PATTERN|$EXTRA_LEAK_PATTERN"; fi
if git -C "$ROOT" ls-files -co --exclude-standard "$PLUGIN" \
  | xargs grep -nIiE "$LEAK_PATTERN" 2>/dev/null; then
  echo "Error: possible private data above; aborting (version bump left uncommitted)"; exit 1
fi
SUSPICIOUS_FILES="$(git -C "$ROOT" ls-files -co --exclude-standard "$PLUGIN" | grep -vE '\.test\.[cm]?[jt]sx?$' | grep -iE '(^|/)\.env|secret|credential|\.pem$|\.p12$|\.pfx$|\.key$|auth\.json$' || true)"
if [ -n "$SUSPICIOUS_FILES" ]; then
  echo "Error: suspicious files would be published:"; echo "$SUSPICIOUS_FILES"; exit 1
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
