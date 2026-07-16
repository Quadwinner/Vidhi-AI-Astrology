// CleverTap Service Worker for AuraAI
// Version: 1.0.0
// Last updated: 2025-01-15

// Import CleverTap's web push service worker
// Note: This may fail on localhost without HTTPS, but works in production
try {
  importScripts('https://s3-eu-west-1.amazonaws.com/static.wizrocket.com/js/sw_webpush.js');
  console.log('[CleverTap SW] CleverTap web push script loaded successfully');
} catch (error) {
  console.error('[CleverTap SW] Failed to load CleverTap web push script:', error);
  // Continue anyway - we'll handle notifications manually
}

// Fallback push event handler if CleverTap script fails to load
self.addEventListener('push', function(event) {
  console.log('[CleverTap SW] Push event received:', event);

  try {
    let data = {};

    // Try to parse as JSON first, fallback to text
    if (event.data) {
      try {
        data = event.data.json();
        console.log('[CleverTap SW] Push data (JSON):', data);
      } catch (jsonError) {
        // If JSON parsing fails, treat as text
        const textData = event.data.text();
        console.log('[CleverTap SW] Push data (text):', textData);
        data = {
          title: 'AstraAura',
          body: textData
        };
      }
    }

    const title = data.title || 'AstraAura Notification';
    const options = {
      body: data.body || data.message || 'You have a new notification',
      icon: data.icon || '/logo192.png',
      badge: '/logo192.png',
      data: data,
      requireInteraction: false,
      tag: data.tag || 'clevertap-notification'
    };

    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  } catch (error) {
    console.error('[CleverTap SW] Error handling push event:', error);

    // Show a fallback notification even if parsing failed
    event.waitUntil(
      self.registration.showNotification('AstraAura', {
        body: 'You have a new notification',
        icon: '/logo192.png',
        badge: '/logo192.png'
      })
    );
  }
});

// Custom notification click handler for deep linking
self.addEventListener('notificationclick', function(event) {
  console.log('[CleverTap SW] Notification click received:', event);

  event.notification.close();

  // Extract deep link URL from notification data
  const notificationData = event.notification.data || {};
  const targetUrl = notificationData.url || notificationData.wzrk_dl || '/';

  console.log('[CleverTap SW] Target URL:', targetUrl);

  // Track click via postMessage to client
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUnrelated: false })
      .then(function(clientList) {
        console.log('[CleverTap SW] Found', clientList.length, 'open clients');

        // Send analytics event to all open clients
        clientList.forEach(client => {
          client.postMessage({
            type: 'NOTIFICATION_CLICKED',
            data: {
              url: targetUrl,
              notificationData: notificationData,
              title: event.notification.title,
              body: event.notification.body,
              timestamp: new Date().toISOString()
            }
          });
        });

        // Try to focus existing window with matching pathname
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          try {
            const clientUrl = new URL(client.url);
            const targetUrlObj = new URL(targetUrl, self.location.origin);

            // Match pathname (ignore query params for focus check)
            if (clientUrl.pathname === targetUrlObj.pathname && 'focus' in client) {
              console.log('[CleverTap SW] Focusing existing client at', client.url);
              return client.focus().then(() => {
                // Navigate to exact URL with query params
                if ('navigate' in client) {
                  return client.navigate(targetUrl);
                }
                return client;
              });
            }
          } catch (e) {
            console.error('[CleverTap SW] Error processing client URL:', e);
          }
        }

        // Otherwise open new window
        if (clients.openWindow) {
          console.log('[CleverTap SW] Opening new window to', targetUrl);
          return clients.openWindow(targetUrl);
        }
      })
      .catch(function(error) {
        console.error('[CleverTap SW] Error handling notification click:', error);
      })
  );
});

// Log service worker activation
self.addEventListener('activate', function(event) {
  console.log('[CleverTap SW] Service worker activated, version 1.0.0');
});

// Log service worker installation
self.addEventListener('install', function(event) {
  console.log('[CleverTap SW] Service worker installed, version 1.0.0');
  // Skip waiting to activate immediately
  self.skipWaiting();
});
