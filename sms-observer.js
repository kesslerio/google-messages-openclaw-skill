/**
 * MutationObserver script to detect new SMS messages in Google Messages web.
 * Inject this into the messages.google.com page via browser automation.
 * 
 * Configuration:
 *   Set WEBHOOK_URL below or pass via query param when injecting.
 * 
 * Usage:
 *   1. Load messages.google.com in browser
 *   2. Inject this script via browser evaluate
 *   3. Script watches for new messages and POSTs to webhook
 * 
 * Debug:
 *   Access window._smsObserver in browser console for debugging.
 */

(function(config) {
  // Tear down previous instance to prevent duplicate observers on re-injection
  if (window._smsObserver) {
    if (window._smsObserverCleanup) {
      window._smsObserverCleanup();
    }
    console.log('[SMS Observer] Previous instance cleaned up, reinitializing...');
  }
  
  // Configuration
  const WEBHOOK_URL = config?.webhookUrl || 'http://127.0.0.1:19888/sms-inbound';
  const CHECK_INTERVAL = config?.checkInterval || 2000; // ms between polls
  const DEBUG = config?.debug || false;
  
  // State
  let lastSeenMessages = new Map(); // contact -> { preview, time }
  let pendingQueue = []; // queue of new incoming messages for polling consumers
  const MAX_PENDING = 50;
  let initialized = false;
  let observerAttached = false;
  
  function log(...args) {
    if (DEBUG || args[0]?.startsWith?.('New message')) {
      console.log('[SMS Observer]', ...args);
    }
  }
  
  function logAlways(...args) {
    console.log('[SMS Observer]', ...args);
  }
  
  /**
   * Extract conversation data from the DOM
   */
  function getConversations() {
    const convos = [];
    const items = document.querySelectorAll(
      'mws-conversation-list-item, ' +
      '[data-e2e-conversation], ' +
      '[role="option"]'
    );
    
    items.forEach((item, i) => {
      // Try multiple selectors for each element
      const nameEl = item.querySelector(
        'h2, ' +
        '[data-e2e-conversation-name], ' +
        '.name, ' +
        '[class*="conversation-name"]'
      );
      
      const previewEl = item.querySelector(
        '[data-e2e-conversation-snippet], ' +
        '.snippet, ' +
        '[class*="snippet"], ' +
        '[class*="preview"]'
      );
      
      const timeEl = item.querySelector(
        '[data-e2e-conversation-timestamp], ' +
        '.timestamp, ' +
        'time, ' +
        '[class*="timestamp"]'
      );
      
      const unreadEl = item.querySelector(
        '.unread-count, ' +
        '[data-e2e-unread], ' +
        '.unread, ' +
        '[class*="unread"]'
      );
      
      // Extract preview text
      let preview = '';
      if (previewEl) {
        preview = previewEl.innerText || previewEl.textContent || '';
      }
      
      // Fallback: look for div with message-like content
      if (!preview) {
        const allDivs = item.querySelectorAll('div');
        for (const div of allDivs) {
          const text = div.innerText?.trim();
          if (text && 
              text.length > 5 && 
              text.length < 200 && 
              text !== nameEl?.innerText?.trim()) {
            preview = text;
            break;
          }
        }
      }
      
      convos.push({
        index: i,
        contact: nameEl?.innerText?.trim() || 'Unknown',
        preview: preview.trim().substring(0, 150),
        time: timeEl?.innerText?.trim() || '',
        hasUnread: !!unreadEl || 
                   item.classList.contains('unread') || 
                   item.querySelector('.unread') !== null
      });
    });
    
    return convos;
  }
  
  /**
   * Check for new messages and notify webhook
   */
  function checkForNewMessages() {
    const conversations = getConversations();
    
    if (!initialized) {
      // First run - just record state, don't notify
      conversations.forEach(c => {
        lastSeenMessages.set(c.contact, { preview: c.preview, time: c.time });
      });
      initialized = true;
      logAlways('Initialized with', conversations.length, 'conversations');
      return;
    }
    
    // Check for new or changed messages
    conversations.forEach(c => {
      const lastSeen = lastSeenMessages.get(c.contact);
      
      // Detect new incoming message
      const isNewMessage = !lastSeen || 
        (lastSeen.preview !== c.preview && c.preview);
      const isIncoming = c.preview && !c.preview.startsWith('You:');
      
      if (isNewMessage && isIncoming) {
        logAlways('New message detected:', c.contact, '-', c.preview.substring(0, 50));
        
        // Add to pending queue for polling consumers
        const entry = {
          contact: c.contact,
          preview: c.preview,
          time: c.time,
          timestamp: Date.now(),
          hasUnread: c.hasUnread
        };
        pendingQueue.push(entry);
        if (pendingQueue.length > MAX_PENDING) {
          pendingQueue.shift(); // drop oldest
        }
        
        // POST to webhook
        fetch(WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contact: c.contact,
            preview: c.preview,
            time: c.time,
            timestamp: Date.now(),
            hasUnread: c.hasUnread
          })
        }).then(r => {
          if (r.ok) log('Webhook notified');
          else logAlways('Webhook returned', r.status);
        }).catch(e => {
          logAlways('Webhook error:', e.message);
        });
      }
      
      // Update tracked state
      lastSeenMessages.set(c.contact, { preview: c.preview, time: c.time });
    });
  }
  
  /**
   * Set up MutationObserver on the conversation list
   */
  function setupObserver() {
    if (observerAttached) {
      log('Observer already attached');
      return;
    }
    
    // Try multiple selectors for the conversation container
    const target = document.querySelector(
      'mws-conversations-list, ' +
      '[data-e2e-conversation-list], ' +
      'nav[role="navigation"], ' +
      'main'
    );
    
    if (!target) {
      log('Conversation list not found, retrying in 2s...');
      setTimeout(setupObserver, 2000);
      return;
    }
    
    const observer = new MutationObserver((mutations) => {
      // Debounce - wait for DOM to settle
      clearTimeout(window._smsObserverTimeout);
      window._smsObserverTimeout = setTimeout(checkForNewMessages, 500);
    });
    
    observer.observe(target, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['class'] // Catch unread state changes
    });
    
    observerAttached = true;
    logAlways('MutationObserver attached to', target.tagName);
    
    // Initial check
    checkForNewMessages();
    
    // Backup polling (in case mutations are missed)
    const pollInterval = setInterval(checkForNewMessages, CHECK_INTERVAL);
    
    // Register cleanup function for safe re-injection
    window._smsObserverCleanup = () => {
      observer.disconnect();
      clearInterval(pollInterval);
      clearTimeout(window._smsObserverTimeout);
      observerAttached = false;
      logAlways('Observer disconnected and intervals cleared');
    };
  }
  
  // Start
  logAlways('Starting SMS observer...');
  logAlways('Webhook URL:', WEBHOOK_URL);
  
  if (document.readyState === 'complete') {
    setupObserver();
  } else {
    window.addEventListener('load', setupObserver);
  }
  
  // Expose API for debugging and management
  window._smsObserver = {
    check: checkForNewMessages,
    getConversations,
    // Return pending queue and clear it (consume semantics)
    getPending: () => {
      const items = pendingQueue.slice();
      pendingQueue.length = 0;
      return items;
    },
    // Check if there are pending messages without consuming
    hasPending: () => {
      return pendingQueue.length > 0;
    },
    // Peek at pending messages without clearing the queue
    peekPending: () => {
      return pendingQueue.slice();
    },
    lastSeen: lastSeenMessages,
    config: { WEBHOOK_URL, CHECK_INTERVAL, DEBUG },
    reinit: () => {
      initialized = false;
      lastSeenMessages.clear();
      pendingQueue.length = 0;
      checkForNewMessages();
    }
  };
  
  logAlways('SMS Observer loaded. Access window._smsObserver for debugging.');
  
  return 'SMS Observer injected successfully';
  
// Pass config object when evaluating, or use defaults
})(typeof __SMS_OBSERVER_CONFIG__ !== 'undefined' ? __SMS_OBSERVER_CONFIG__ : {});
