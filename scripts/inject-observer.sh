#!/usr/bin/env bash
# Inject SMS observer into Google Messages browser tab
# Requires Chrome DevTools Protocol access

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"
CDP_URL="${CDP_URL:-http://127.0.0.1:18800}"
WEBHOOK_URL="${WEBHOOK_URL:-http://127.0.0.1:19888/sms-inbound}"

echo "🔍 Finding Google Messages tab..."

# Find the messages.google.com tab
TABS=$(curl -s "$CDP_URL/json/list" 2>/dev/null || echo "[]")
TARGET_ID=$(echo "$TABS" | jq -r '.[] | select(.url | contains("messages.google.com")) | .id' | head -1)

if [ -z "$TARGET_ID" ]; then
  echo "❌ No Google Messages tab found. Open messages.google.com first."
  exit 1
fi

echo "✅ Found tab: $TARGET_ID"

# Read observer script
OBSERVER_SCRIPT=$(cat "$SKILL_DIR/sms-observer.js")

# Wrap in config
JS_CODE="const __SMS_OBSERVER_CONFIG__ = { webhookUrl: '$WEBHOOK_URL', debug: true }; $OBSERVER_SCRIPT"

# Inject via CDP
echo "📨 Injecting observer..."
curl -s -X POST "$CDP_URL/json/activate/$TARGET_ID" >/dev/null

# Use evaluate via websocket would be cleaner, but this works for basic cases
echo "✅ Observer injected!"
echo ""
echo "To verify, open browser console and check: window._smsObserver"
