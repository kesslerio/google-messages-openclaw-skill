# Observer Polling Documentation

## Overview

The polling-based observer stores incoming messages in memory and exposes them via `window._smsObserver` for the agent to poll.

## Why Polling?

Chrome's Private Network Access restrictions prevent sandboxed browsers from making HTTP requests to localhost. This means the browser cannot push notifications to a webhook server.

The polling approach works around this:
1. Browser stores notifications in `window._smsObserver`
2. Agent periodically checks `window._smsObserver.getPending()`
3. Agent forwards notifications to preferred channel

## API Reference

### `getPending()`
Returns array of pending notifications and clears the queue.

```javascript
const messages = window._smsObserver.getPending();
// Returns: [{ contact, preview, time, timestamp, hasUnread }, ...]
```

### `hasPending()`
Returns true if there are pending notifications.

```javascript
if (window._smsObserver.hasPending()) {
  // There are new messages
}
```

### `peekPending()`
Returns pending notifications without clearing the queue.

```javascript
const messages = window._smsObserver.peekPending();
// Queue remains unchanged
```

### `check()`
Force an immediate check for new messages.

```javascript
window._smsObserver.check();
```

### `getConversations()`
Get current conversation list from DOM.

```javascript
const convos = window._smsObserver.getConversations();
// Returns: [{ index, contact, preview, time, hasUnread }, ...]
```

## Configuration

When injecting, you can pass configuration:

```javascript
const __SMS_OBSERVER_CONFIG__ = {
  checkInterval: 2000,  // ms between polls
  debug: false          // verbose logging
};
```

## Limitations

- Messages lost if page reloads (queue is in memory only)
- Polling delay means ~2-5 second latency
- Queue limited to 50 messages (oldest dropped)
