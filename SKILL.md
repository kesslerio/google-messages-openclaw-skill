---
name: google-messages
description: Send and receive SMS/RCS via Google Messages web interface (messages.google.com). Use when asked to "send a text", "check texts", "SMS", "text message", or "Google Messages".
metadata: {"openclaw": {"emoji": "💬", "requires": {"tools": ["browser"]}}}
---

# Google Messages Browser Skill

Automate SMS/RCS messaging via messages.google.com using the `browser` tool.

---

## Overview

Google Messages for Web allows you to send/receive texts from your Android phone via browser. This skill automates that interface.

**Requirements:**
- Android phone with Google Messages app
- Phone and computer on same network (for initial QR pairing)
- Browser profile with persistent session (recommended: `openclaw` or dedicated profile)

---

## Initial Setup (QR Pairing)

First-time setup requires scanning a QR code:

### Step 1: Open Google Messages Web
```
browser action=open profile=openclaw targetUrl="https://messages.google.com/web/authentication"
```

### Step 2: Take screenshot to see QR code
```
browser action=screenshot profile=openclaw
```

### Step 3: Scan QR with phone
1. Open Google Messages app on Android
2. Tap three-dot menu → "Device pairing"
3. Tap "QR code scanner"
4. Scan the QR code shown in browser

### Step 4: Verify connection
```
browser action=snapshot profile=openclaw
```

Look for conversation list indicating successful pairing.

**Note:** Check "Remember this computer" on the web page to persist the session.

---

## Sending Messages

### Step 1: Navigate to messages
```
browser action=navigate profile=openclaw targetUrl="https://messages.google.com/web/conversations"
```

### Step 2: Find or start conversation
Take a snapshot, find the conversation by contact name, click it:
```
browser action=snapshot profile=openclaw
browser action=act profile=openclaw request={"kind": "click", "ref": "<conversation_ref>"}
```

### Step 3: Type and send message
Find the message input ref from snapshot, then:
```
browser action=act profile=openclaw request={"kind": "type", "ref": "<input_ref>", "text": "Your message here"}
browser action=act profile=openclaw request={"kind": "click", "ref": "<send_button_ref>"}
```

---

## Receiving Messages (Real-time via Webhook)

This skill includes a real-time notification system using a MutationObserver and webhook.

### Components

1. **sms-webhook-server.js** - HTTP server that receives notifications and forwards to your preferred channel
2. **sms-observer.js** - Browser script that watches for new messages and POSTs to the webhook

### Setup

#### 1. Configure the webhook server

Edit `sms-webhook-server.js` and set your notification target:
```javascript
const NOTIFICATION_TARGET = 'telegram:YOUR_CHAT_ID'; // or other OpenClaw channel
const NOTIFICATION_CHANNEL = 'telegram'; // telegram, whatsapp, signal, etc.
```

#### 2. Start the webhook server
```bash
node sms-webhook-server.js
# Or install as systemd service (see below)
```

#### 3. Inject the observer into the browser

After the Google Messages page is loaded:
```
browser action=act profile=openclaw request={"kind": "evaluate", "fn": "<contents of sms-observer.js>"}
```

Or use the helper script:
```bash
./scripts/inject-observer.sh
```

### Systemd Service (Persistent)

Install as a systemd user service:

```bash
mkdir -p ~/.config/systemd/user
cp systemd/google-messages-webhook.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now google-messages-webhook
```

Check status:
```bash
systemctl --user status google-messages-webhook
journalctl --user -u google-messages-webhook -f
```

---

## Alternative: Polling Mode

If you prefer polling (no webhook server needed):

```javascript
// Inject sms-observer.js (polling version)
eval(smsObserverScript);

// Poll for messages
const pending = window._smsObserver.getPending();
```

See `references/observer-polling.md` for details.

---

## Reading Messages

### Get recent conversations
```javascript
(() => {
  const convos = document.querySelectorAll('mws-conversation-list-item');
  const results = [];
  
  for (let i = 0; i < Math.min(convos.length, 10); i++) {
    const name = convos[i].querySelector('h2')?.innerText || 'Unknown';
    const preview = convos[i].querySelector('[data-e2e-conversation-snippet]')?.innerText || '';
    const time = convos[i].querySelector('[data-e2e-conversation-timestamp]')?.innerText || '';
    
    results.push({ name: name.trim(), preview: preview.trim().substring(0, 50), time: time.trim() });
  }
  
  return JSON.stringify(results, null, 2);
})()
```

### Get messages in current conversation
```javascript
(() => {
  const messages = document.querySelectorAll('mws-message-wrapper');
  const results = [];
  const start = Math.max(0, messages.length - 10);
  
  for (let i = start; i < messages.length; i++) {
    const msg = messages[i];
    const text = msg.querySelector('[data-e2e-message-text]')?.innerText || '';
    const time = msg.querySelector('[data-e2e-message-timestamp]')?.innerText || '';
    const isOutgoing = msg.classList.contains('outgoing');
    
    if (text) {
      results.push({ text: text.trim(), time: time.trim(), direction: isOutgoing ? 'sent' : 'received' });
    }
  }
  
  return JSON.stringify(results, null, 2);
})()
```

---

## Selectors Reference

Google Messages uses Angular/Material components. These selectors may change with updates.

| Element | Selectors |
|---------|-----------|
| Conversation list | `mws-conversations-list` |
| Single conversation | `mws-conversation-list-item` |
| Message input | `textarea[aria-label*="message"]` |
| Send button | `button[aria-label*="Send"]` |
| QR code | `mw-qr-code` |
| New conversation | `button[aria-label*="Start chat"]` |

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| QR code shown | Session expired, need to re-pair |
| Elements not found | Google updated UI, check snapshot for new selectors |
| Send button disabled | Message input empty or phone disconnected |
| "Phone not connected" | Phone needs internet, same Google account |
| Observer not detecting | Check browser console for errors |
| Webhook not receiving | Verify server is running on port 19888 |
| Duplicate messages | Server-side deduplication should prevent this; check logs |

---

## Limitations

1. **Phone must be online** - Messages sync through phone
2. **Same Google account** - Phone and web must use same account
3. **Session expires** - May need re-pairing after ~14 days of inactivity
4. **Browser tab required** - Must stay open for notifications
5. **Re-inject on reload** - Observer script lost if page refreshes

---

## Security Notes

- Session persists in browser profile cookies
- Don't share browser profile with session
- Consider dedicated browser profile for this skill
- QR pairing links to your phone - treat as sensitive
- Webhook server listens only on localhost by default

---

## License

Apache-2.0
