#!/usr/bin/env bash
# Poll Google Messages for new SMS and forward to Telegram
# Called by Lobster workflow or cron

set -e

NOTIFICATION_TARGET="${SMS_NOTIFICATION_TARGET:-}"
NOTIFICATION_CHANNEL="${SMS_NOTIFICATION_CHANNEL:-telegram}"
STATE_FILE="${SMS_STATE_FILE:-/tmp/sms-observer-state.json}"

if [[ -z "$NOTIFICATION_TARGET" ]]; then
  echo "SMS_NOTIFICATION_TARGET not set, skipping" >&2
  exit 0
fi

# Source SMS security filter
SMS_FILTER_LIB="${HOME}/.local/lib/sms-security-filter.sh"
if [[ -f "$SMS_FILTER_LIB" ]]; then
  # shellcheck source=/dev/null
  source "$SMS_FILTER_LIB"
  _SMS_FILTER_LOADED=1
else
  _SMS_FILTER_LOADED=0
fi

# Get pending messages from browser via CDP
get_pending() {
  # Find the messages.google.com tab
  local tabs=$(curl -s http://127.0.0.1:18800/json/list 2>/dev/null)
  local target_id=$(echo "$tabs" | jq -r '.[] | select(.url | contains("messages.google.com")) | .id' | head -1)
  
  if [ -z "$target_id" ]; then
    echo "[]"
    return
  fi
  
  # Evaluate getPending via CDP
  local result=$(curl -s "http://127.0.0.1:18800/json/evaluate" \
    -H "Content-Type: application/json" \
    -d "{\"targetId\":\"$target_id\",\"expression\":\"JSON.stringify(window._smsObserver ? window._smsObserver.getPending() : [])\"}" 2>/dev/null)
  
  echo "$result" | jq -r '.result.value // "[]"' 2>/dev/null || echo "[]"
}

# Forward a message
forward_message() {
  local contact="$1"
  local preview="$2"
  
  local msg="📱 SMS from $contact: $preview"
  
  openclaw message send -t "$NOTIFICATION_TARGET" --channel "$NOTIFICATION_CHANNEL" -m "$msg" 2>/dev/null || {
    echo "Failed to forward: $msg" >&2
    return 1
  }
  
  echo "Forwarded: $contact"
}

# Main
pending=$(get_pending)

if [ "$pending" = "[]" ] || [ -z "$pending" ]; then
  echo "No pending messages"
  exit 0
fi

# Process each message
echo "$pending" | jq -c '.[]' | while read -r msg; do
  contact=$(echo "$msg" | jq -r '.contact')
  preview=$(echo "$msg" | jq -r '.preview')
  
  if [ -n "$contact" ] && [ "$contact" != "null" ]; then
    # Skip sensitive messages (2FA, OTP, password resets)
    if [[ "$_SMS_FILTER_LOADED" -eq 1 ]] && sms_is_sensitive "$contact" "$preview" "$contact"; then
      echo "Filtered sensitive: $contact"
      continue
    fi
    forward_message "$contact" "$preview"
  fi
done
