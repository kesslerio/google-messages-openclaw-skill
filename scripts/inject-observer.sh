#!/usr/bin/env bash
# Inject the SMS observer into the Google Messages browser tab
# 
# Usage: ./inject-observer.sh [profile] [targetId]
#   profile  - Browser profile (default: openclaw)
#   targetId - Browser tab target ID (optional, will find messages.google.com tab)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROFILE="${1:-openclaw}"

# Read the observer script
OBSERVER_SCRIPT=$(cat "$SCRIPT_DIR/sms-observer.js")

# Escape for JSON
ESCAPED_SCRIPT=$(echo "$OBSERVER_SCRIPT" | jq -Rs .)

echo "Injecting SMS observer into Google Messages..."

# Use openclaw browser tool to evaluate the script
# This assumes openclaw CLI is available
if command -v openclaw &> /dev/null; then
    openclaw browser evaluate \
        --profile "$PROFILE" \
        --url "messages.google.com" \
        --script "$ESCAPED_SCRIPT"
else
    echo "Error: openclaw CLI not found"
    echo "Inject the script manually using browser devtools or the browser tool"
    exit 1
fi

echo "Observer injected successfully"
