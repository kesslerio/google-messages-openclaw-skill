# JavaScript Snippets for Google Messages

## Send a Message

```javascript
async function sendMessage(contactName, messageText) {
  // Click new conversation button
  const newChatBtn = document.querySelector('button[aria-label*="Start chat"]');
  if (newChatBtn) newChatBtn.click();
  
  // Wait for input
  await new Promise(r => setTimeout(r, 500));
  
  // Type contact name
  const contactInput = document.querySelector('input[placeholder*="Type a name"]');
  if (contactInput) {
    contactInput.value = contactName;
    contactInput.dispatchEvent(new Event('input', { bubbles: true }));
  }
  
  // Wait for results and click first
  await new Promise(r => setTimeout(r, 1000));
  const firstResult = document.querySelector('[role="option"]');
  if (firstResult) firstResult.click();
  
  // Wait for conversation to open
  await new Promise(r => setTimeout(r, 500));
  
  // Type message
  const msgInput = document.querySelector('textarea[aria-label*="message"]');
  if (msgInput) {
    msgInput.value = messageText;
    msgInput.dispatchEvent(new Event('input', { bubbles: true }));
  }
  
  // Click send
  await new Promise(r => setTimeout(r, 200));
  const sendBtn = document.querySelector('button[aria-label*="Send"]');
  if (sendBtn) sendBtn.click();
}
```

## Read Latest Messages

```javascript
function getLatestMessages(count = 5) {
  const messages = document.querySelectorAll('mws-message-wrapper');
  const results = [];
  const start = Math.max(0, messages.length - count);
  
  for (let i = start; i < messages.length; i++) {
    const msg = messages[i];
    const textEl = msg.querySelector('[data-e2e-message-text]');
    const timeEl = msg.querySelector('[data-e2e-message-timestamp]');
    const isOutgoing = msg.classList.contains('outgoing');
    
    if (textEl) {
      results.push({
        text: textEl.innerText.trim(),
        time: timeEl?.innerText?.trim() || '',
        direction: isOutgoing ? 'sent' : 'received'
      });
    }
  }
  
  return results;
}
```

## Get Conversation List

```javascript
function getConversations() {
  const items = document.querySelectorAll('mws-conversation-list-item');
  return Array.from(items).map(item => ({
    name: item.querySelector('h2')?.innerText?.trim() || 'Unknown',
    preview: item.querySelector('[data-e2e-conversation-snippet]')?.innerText?.trim() || '',
    time: item.querySelector('[data-e2e-conversation-timestamp]')?.innerText?.trim() || ''
  }));
}
```

## Click Conversation by Name

```javascript
function openConversation(name) {
  const items = document.querySelectorAll('mws-conversation-list-item');
  for (const item of items) {
    const itemName = item.querySelector('h2')?.innerText?.trim();
    if (itemName?.toLowerCase().includes(name.toLowerCase())) {
      item.click();
      return true;
    }
  }
  return false;
}
```

## Check for Unread Messages

```javascript
function hasUnreadMessages() {
  const unreadBadges = document.querySelectorAll('.unread-count, [data-e2e-unread]');
  return unreadBadges.length > 0;
}

function getUnreadConversations() {
  const items = document.querySelectorAll('mws-conversation-list-item');
  return Array.from(items).filter(item => {
    return item.querySelector('.unread-count, [data-e2e-unread]') !== null;
  }).map(item => ({
    name: item.querySelector('h2')?.innerText?.trim(),
    preview: item.querySelector('[data-e2e-conversation-snippet]')?.innerText?.trim()
  }));
}
```
