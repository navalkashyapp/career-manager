#!/usr/bin/env bash
set -e

# Ensure cloudflared is accessible
if command -v cloudflared &> /dev/null; then
  CLOUDFLARED_BIN="cloudflared"
elif [ -x "$HOME/.local/bin/cloudflared" ]; then
  CLOUDFLARED_BIN="$HOME/.local/bin/cloudflared"
else
  echo "❌ cloudflared binary not found in PATH or ~/.local/bin"
  exit 1
fi

# Load .env if present
if [ -f .env ]; then
  set -a
  source .env 2>/dev/null || true
  set +a
fi

PORT="${PORT:-3000}"

if [ -n "$CLOUDFLARE_TUNNEL_TOKEN" ]; then
  echo "🔒 Starting Cloudflare Named Tunnel using configured token..."
  exec "$CLOUDFLARED_BIN" tunnel run --token "$CLOUDFLARE_TUNNEL_TOKEN"
else
  echo "🌐 Starting Cloudflare Quick Tunnel (TryCloudflare) forwarding to http://localhost:${PORT}..."
  echo "💡 Tip: If you have a Cloudflare account with a custom domain, set CLOUDFLARE_TUNNEL_TOKEN in your .env"
  exec "$CLOUDFLARED_BIN" tunnel --url "http://localhost:${PORT}"
fi
