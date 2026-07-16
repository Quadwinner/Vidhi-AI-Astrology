import { track } from '@amplitude/analytics-browser';
import clevertap, { isCleverTapInitialized } from '../clevertapClient';

// Helper to get CleverTap instance (with fallback to window)
function getCleverTap() {
  try {
    // Try the imported instance first
    if (clevertap && typeof clevertap.event?.push === 'function') {
      return clevertap;
    }
    // Fallback to window.clevertap
    if (typeof window !== 'undefined' && (window as any).clevertap) {
      const winCleverTap = (window as any).clevertap;
      if (typeof winCleverTap.event?.push === 'function') {
        return winCleverTap;
      }
    }
  } catch (err) {
    console.warn('[Analytics] Error accessing CleverTap:', err);
  }
  return null;
}

export function trackEvent(eventName: string, props?: Record<string, any>) {
  // Track in Amplitude
  try {
    track(eventName, props);
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Analytics] Amplitude tracking failed:', err);
    }
  }

  // Track in CleverTap
  try {
    if (!isCleverTapInitialized) {
      console.warn('[Analytics] ⚠️ CleverTap not initialized. Event not tracked:', eventName);
      console.warn('[Analytics] Check that REACT_APP_CLEVERTAP_ACCOUNT_ID is set in environment variables');
      return; // Early return to avoid unnecessary processing
    }
    
    const ct = getCleverTap();
    if (ct && typeof ct.event?.push === 'function') {
      ct.event.push(eventName, props || {});
      if (process.env.NODE_ENV === 'development') {
        console.log('[Analytics] ✅ CleverTap event tracked:', eventName, props);
      }
    } else {
      console.warn('[Analytics] ⚠️ CleverTap SDK not available. Event not tracked:', eventName);
    }
  } catch (err) {
    console.error('[Analytics] ❌ CleverTap tracking failed:', err);
    console.error('[Analytics] Event:', eventName, 'Props:', props);
  }
}

