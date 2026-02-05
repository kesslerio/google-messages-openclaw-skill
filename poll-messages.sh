#!/usr/bin/env bash
# Poll Google Messages for new messages and notify via Telegram
# Run via cron or manually

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_FILE="$SCRIPT_DIR/.last_messages.json"
NOTIFICATION_TARGET="${SMS_NOTIFICATION_TARGET:-telegram:8352721935}"
NOTIFICATION_CHANNEL="${SMS_NOTIFICATION_CHANNEL:-telegram}"

# Get current conversations via browser
get_conversations() {
  openclaw browser evaluate --profile openclaw --url "messages.google.com" --script '
    (function() {
      var convos = [];
      var items = document.querySelectorAll("mws-conversation-list-item,[role=\"option\"]");
      items.forEach(function(item, i) {
        if (i >= 10) return;
        var nameEl = item.querySelector("h2,.name");
        var previewEl = item.querySelector("[data-e2e-conversation-snippet],.snippet");
        var timeEl = item.querySelector("[data-e2e-conversation-timestamp],.timestamp");
        convos.push({
          contact: nameEl ? nameEl.innerText.trim() : "Unknown",
          preview: previewEl ? previewEl.innerText.trim().substring(0,100) : "",
          time: timeEl ? timeEl.innerText.trim() : ""
        });
      });
      return JSON.stringify(convos);
    })()
  ' 2>/dev/null
}

# Main
CURRENT=$(get_conversations)

if [ -z "$CURRENT" ]; then
  echo "Failed to get conversations"
  exit 1
fi

# Compare with last state
if [ -f "$STATE_FILE" ]; then
  LAST=$(cat "$STATE_FILE")
  
  # Simple diff - check if any new incoming messages
  echo "$CURRENT" | jq -r '.[] | select(.preview | startswith("You:") | not) | "\(.contact)|\(.preview)"' | while read line; do
    contact=$(echo "$line" | cut -d'|' -f1)
    preview=$(echo "$line" | cut -d'|' -f2)
    
    # Check if this message was in last state
    if ! echo "$LAST" | grep -qF "$preview"; then
      echo "New message from $contact: $preview"
      openclaw message send -t "$NOTIFICATION_TARGET" --channel "$NOTIFICATION_CHANNEL" -m "📱 SMS from $contact: $preview" 2>/dev/null || true
    fi
  done
fi

# Save current state
echo "$CURRENT" > "$STATE_FILE"
