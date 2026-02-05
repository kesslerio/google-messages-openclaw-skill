/**
 * MutationObserver script to detect new SMS messages in Google Messages web.
 * Inject this into the messages.google.com page via browser automation.
 * 
 * This is the polling-based version - messages are stored in memory and
 * retrieved via window._smsObserver.getPending()
 */

(function(config) {
  // Configuration
  const CHECK_INTERVAL = config?.checkInterval || 2000; // ms between polls
  const DEBUG = config?.debug || false;
  
  // State
  let lastSeenMessages = new Map(); // contact -> { preview, time }
  let pendingNotifications = []; // Queue of new messages to be picked up
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
   * Check for new messages and queue notifications
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
        
        // Add to pending queue (for polling retrieval)
        pendingNotifications.push({
          contact: c.contact,
          preview: c.preview,
          time: c.time,
          timestamp: Date.now(),
          hasUnread: c.hasUnread
        });
        
        // Limit queue size
        if (pendingNotifications.length > 50) {
          pendingNotifications = pendingNotifications.slice(-50);
        }
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
    setInterval(checkForNewMessages, CHECK_INTERVAL);
  }
  
  // Start
  logAlways('Starting SMS observer (polling mode)...');
  
  if (document.readyState === 'complete') {
    setupObserver();
  } else {
    window.addEventListener('load', setupObserver);
  }
  
  // Expose API for polling retrieval
  window._smsObserver = {
    // Get and clear pending notifications
    getPending: () => {
      const pending = [...pendingNotifications];
      pendingNotifications = [];
      return pending;
    },
    // Check without clearing
    hasPending: () => pendingNotifications.length > 0,
    // Peek without clearing
    peekPending: () => [...pendingNotifications],
    // Force check
    check: checkForNewMessages,
    // Get conversations
    getConversations,
    // Debug info
    _config: { CHECK_INTERVAL, DEBUG }
  };
  
  logAlways('SMS Observer loaded (polling mode). Access window._smsObserver for debugging.');
  
  return 'SMS Observer injected successfully (polling mode)';
  
})(typeof __SMS_OBSERVER_CONFIG__ !== 'undefined' ? __SMS_OBSERVER_CONFIG__ : {});
