#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  Download the static FFmpeg binary for Amazon Linux 2 x86_64
#  Used by the Lambda Layer at lambda/layers/ffmpeg/bin/ffmpeg
#  Run this script once before deploying (CI/CD or local dev).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

DEST="$(cd "$(dirname "$0")/.." && pwd)/lambda/layers/ffmpeg/bin"
mkdir -p "$DEST"

echo "⬇️  Downloading FFmpeg static build (amd64)..."
TMP=$(mktemp -d)
curl -L -o "$TMP/ffmpeg.tar.xz" \
  "https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz"

tar xf "$TMP/ffmpeg.tar.xz" -C "$TMP"
cp "$TMP"/ffmpeg-*-amd64-static/ffmpeg "$DEST/ffmpeg"
chmod +x "$DEST/ffmpeg"
rm -rf "$TMP"

echo "✅  FFmpeg installed → $DEST/ffmpeg ($(du -sh "$DEST/ffmpeg" | cut -f1))"

