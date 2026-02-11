#!/usr/bin/env bash
# Inject SMS observer into Google Messages browser tab
# Requires Chrome DevTools Protocol access via CDP_URL
#
# Uses Runtime.evaluate over WebSocket to actually execute the JS code
# (the old version only called /json/activate which focuses the tab but
# never evaluates anything).

set -euo pipefail

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

# Get the WebSocket debugger URL for this tab
WS_URL=$(echo "$TABS" | jq -r ".[] | select(.id == \"$TARGET_ID\") | .webSocketDebuggerUrl" | head -1)

if [ -z "$WS_URL" ] || [ "$WS_URL" = "null" ]; then
  echo "❌ Could not get WebSocket URL for tab. Is DevTools already attached?"
  exit 1
fi

echo "🔗 WebSocket: $WS_URL"

# Read observer script and build the JS payload
OBSERVER_SCRIPT=$(cat "$SKILL_DIR/sms-observer.js")
# Use var (not const) so re-injection in the same tab doesn't throw
# "Identifier has already been declared"
JS_CODE="var __SMS_OBSERVER_CONFIG__ = { webhookUrl: '$WEBHOOK_URL', debug: true }; $OBSERVER_SCRIPT"

# Evaluate via CDP WebSocket using Node.js
echo "📨 Injecting observer via Runtime.evaluate..."

# Capture exit code explicitly (don't let set -e kill us before diagnostics)
RESULT=""
EXIT_CODE=0
RESULT=$(NODE_PATH="$SKILL_DIR/node_modules" node -e "
const WebSocket = require('ws');
const ws = new WebSocket(process.argv[1]);
const js = Buffer.from(process.argv[2], 'base64').toString('utf8');
const timeout = setTimeout(() => { console.error('Timeout'); process.exit(1); }, 10000);

ws.on('open', () => {
  ws.send(JSON.stringify({
    id: 1,
    method: 'Runtime.evaluate',
    params: { expression: js, returnByValue: true }
  }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data);
  if (msg.id === 1) {
    clearTimeout(timeout);
    if (msg.result?.exceptionDetails) {
      console.error('JS error:', JSON.stringify(msg.result.exceptionDetails));
      ws.close();
      process.exit(1);
    }
    const val = msg.result?.result?.value;
    console.log(val || 'Evaluated (no return value)');
    ws.close();
  }
});

ws.on('error', (err) => {
  console.error('WebSocket error:', err.message);
  process.exit(1);
});
" "$WS_URL" "$(echo "$JS_CODE" | base64 -w0)" 2>&1) || EXIT_CODE=$?

if [ "$EXIT_CODE" -ne 0 ]; then
  echo "❌ Injection failed: $RESULT"
  exit 1
fi

echo "✅ Observer injected: $RESULT"
echo ""
echo "To verify, open browser console and check: window._smsObserver"
