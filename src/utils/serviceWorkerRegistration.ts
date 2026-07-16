// Service Worker Registration Utility for CleverTap Web Push
// Handles registration, updates, and error handling

export interface ServiceWorkerConfig {
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onError?: (error: Error) => void;
}

const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
    window.location.hostname === '[::1]' ||
    window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/)
);

export function register(config?: ServiceWorkerConfig): void {
  // Always try to register (browser will handle permissions)
  console.log('[SW Registration] Starting registration process...');

  // Check HTTPS requirement (except localhost)
  if (!isLocalhost && window.location.protocol !== 'https:') {
    console.warn('[SW Registration] CleverTap Web Push requires HTTPS. Current protocol:', window.location.protocol);
    return;
  }

  // Check browser support
  if (!('serviceWorker' in navigator)) {
    console.warn('[SW Registration] Service Worker not supported in this browser');
    return;
  }

  if (!('PushManager' in window)) {
    console.warn('[SW Registration] Push notifications not supported in this browser');
    return;
  }

  // Register service worker after page load
  window.addEventListener('load', () => {
    const swUrl = `${process.env.PUBLIC_URL}/clevertap_sw.js`;

    if (isLocalhost) {
      // In localhost, check if service worker file exists first
      checkValidServiceWorker(swUrl, config);
    } else {
      // In production, register directly
      registerValidSW(swUrl, config);
    }
  });
}

function registerValidSW(swUrl: string, config?: ServiceWorkerConfig): void {
  navigator.serviceWorker
    .register(swUrl)
    .then((registration) => {
      console.log('[SW Registration] CleverTap service worker registered:', registration.scope);

      // Check for updates on page load
      registration.update();

      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (installingWorker == null) {
          return;
        }

        installingWorker.onstatechange = () => {
          if (installingWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              // At this point, the updated service worker is installed but waiting to activate
              console.log('[SW Registration] New CleverTap SW version available. Refresh to update.');

              if (config?.onUpdate) {
                config.onUpdate(registration);
              }
            } else {
              // Service worker installed for the first time
              console.log('[SW Registration] CleverTap SW installed for the first time');

              if (config?.onSuccess) {
                config.onSuccess(registration);
              }
            }
          }
        };
      };
    })
    .catch((error) => {
      console.error('[SW Registration] Error registering CleverTap service worker:', error);

      if (config?.onError) {
        config.onError(error);
      }
    });
}

function checkValidServiceWorker(swUrl: string, config?: ServiceWorkerConfig): void {
  // Check if service worker file exists and is valid
  fetch(swUrl, {
    headers: { 'Service-Worker': 'script' },
  })
    .then((response) => {
      // Ensure service worker exists and we're getting a valid JS file
      const contentType = response.headers.get('content-type');
      if (
        response.status === 404 ||
        (contentType != null && contentType.indexOf('javascript') === -1)
      ) {
        console.error('[SW Registration] Service worker not found at', swUrl);
        // No service worker found. Unregister any existing one
        navigator.serviceWorker.ready.then((registration) => {
          registration.unregister().then(() => {
            console.log('[SW Registration] Previous service worker unregistered');
          });
        });
      } else {
        // Found service worker, proceed with registration
        registerValidSW(swUrl, config);
      }
    })
    .catch(() => {
      console.log('[SW Registration] No internet connection. App running in offline mode.');
    });
}

export function unregister(): void {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
        console.log('[SW Registration] Service worker unregistered');
      })
      .catch((error) => {
        console.error('[SW Registration] Error unregistering service worker:', error);
      });
  }
}

// Check current registration status (useful for debugging)
export async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    return registration || null;
  } catch (error) {
    console.error('[SW Registration] Error getting registration:', error);
    return null;
  }
}

// Check if service worker is registered and active
export async function isServiceWorkerActive(): Promise<boolean> {
  const registration = await getRegistration();
  return registration?.active != null;
}
