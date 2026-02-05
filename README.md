# Google Messages Skill for OpenClaw

Send and receive SMS/RCS messages via Google Messages web interface using browser automation.

## Features

- 📤 **Send SMS** — Compose and send text messages
- 📥 **Receive notifications** — Detect incoming messages via polling
- 🔍 **Read conversations** — Query recent messages and conversation history
- 🔗 **OpenClaw integration** — Forward incoming SMS to Telegram, WhatsApp, or other channels

## Requirements

- [OpenClaw](https://github.com/openclaw/openclaw) with browser automation
- Android phone with Google Messages app

## Quick Start

### 1. Install the skill

```bash
# Clone to your skills directory
git clone https://github.com/kesslerio/google-messages-openclaw-skill.git ~/.openclaw/skills/google-messages
```

### 2. Pair with your phone

Ask your OpenClaw agent:
```
"Open Google Messages and show me the QR code"
```

Or manually:
1. Go to https://messages.google.com/web
2. Open Google Messages on your phone
3. Tap ⋮ → Device pairing → QR code scanner
4. Scan the code

### 3. Enable incoming message detection

The agent injects an observer script that watches for new messages. When polled, it returns any pending notifications which can be forwarded to your preferred channel.

## Usage

### Sending messages

Ask your OpenClaw agent:
- "Text John that I'm running late"
- "Send an SMS to 555-1234 saying hello"
- "Message Mom on Google Messages"

### Checking messages

- "Check my texts"
- "Any new SMS messages?"
- "What did John text me?"

## How It Works

1. **Browser automation** — Uses OpenClaw's browser tool to control messages.google.com
2. **MutationObserver** — Injects a script that watches the DOM for new messages
3. **Polling** — Agent periodically checks `window._smsObserver.getPending()` for new messages
4. **Forwarding** — Agent sends notifications to your preferred channel via `openclaw message send`

### Why Polling Instead of Webhooks?

Sandboxed browser environments (like OpenClaw's headless Chrome) cannot make HTTP requests to localhost due to Chrome's Private Network Access restrictions. The polling approach works around this by having the agent pull messages rather than the browser push them.

## Files

```
google-messages-skill/
├── SKILL.md                    # OpenClaw skill definition
├── sms-observer.js             # Browser injection script (polling mode)
├── references/
│   ├── snippets.md             # JavaScript helper snippets
│   └── observer-polling.md     # Observer documentation
└── LICENSE
```

## Observer API

After injection, `window._smsObserver` provides:

| Method | Description |
|--------|-------------|
| `getPending()` | Get and clear pending notifications |
| `hasPending()` | Check if there are pending notifications |
| `peekPending()` | Get pending without clearing |
| `check()` | Force check for new messages |
| `getConversations()` | Get current conversation list |

## Limitations

- Phone must be online (messages sync through phone)
- Browser tab must stay open for notifications
- Session expires after ~14 days of inactivity
- Observer lost on page reload (re-inject needed)
- Polling has slight delay vs real-time webhooks

## Security

- No external servers or webhooks required
- Session stored in browser profile cookies
- Observer runs only on messages.google.com

## License

Apache-2.0

## Contributing

Issues and PRs welcome at https://github.com/kesslerio/google-messages-openclaw-skill
