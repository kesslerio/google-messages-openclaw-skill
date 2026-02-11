#!/usr/bin/env bash
# Start the SMS webhook server

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"

cd "$SKILL_DIR"

echo "🚀 Starting SMS webhook server..."
echo "📡 Webhook: http://127.0.0.1:19888/sms-inbound"
echo "📊 Health:  http://127.0.0.1:19888/health"
echo ""

# Check if already running
if pgrep -f "sms-webhook-server.js" > /dev/null; then
  echo "⚠️  Webhook server already running"
  echo "   Use: pkill -f sms-webhook-server.js  # to stop"
  exit 1
fi

exec node "$SKILL_DIR/sms-webhook-server.js"
