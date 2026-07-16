import clevertap from 'clevertap-web-sdk';

const CLEVERTAP_ACCOUNT_ID = process.env.REACT_APP_CLEVERTAP_ACCOUNT_ID;
// Map "global" region to "eu1" for Web SDK (global is not a valid Web SDK region code)
const rawRegion = process.env.REACT_APP_CLEVERTAP_REGION || 'global';
const CLEVERTAP_REGION = rawRegion === 'global' ? 'eu1' : rawRegion;

// Ensure global reference for debugging
if (typeof window !== 'undefined') {
  (window as any).clevertap = clevertap;
}

// Export initialization status
export let isCleverTapInitialized = false;

if (CLEVERTAP_ACCOUNT_ID) {
  try {
    // Required for Single Page Applications (React)
    clevertap.spa = true;
    
    // Initialize CleverTap
    clevertap.init(CLEVERTAP_ACCOUNT_ID, CLEVERTAP_REGION);
    
    // Privacy settings
    clevertap.privacy.push({ optOut: false });
    clevertap.privacy.push({ useIP: true });
    
    // Enable debug logging in development
    if (process.env.NODE_ENV === 'development') {
      clevertap.setLogLevel(3); // 0: disable, 1: errors, 2: errors+info, 3: all logs
    }
    
    // Verify initialization
    if (typeof clevertap.event?.push === 'function') {
      isCleverTapInitialized = true;
      console.log('[CleverTap] ✅ Initialized successfully');
      console.log('[CleverTap] Account ID:', CLEVERTAP_ACCOUNT_ID, 'Region:', CLEVERTAP_REGION);
      
      // Send a test event to verify tracking works
      try {
        clevertap.event.push('CleverTap Initialized', {
          'Environment': process.env.NODE_ENV || 'unknown',
          'Timestamp': new Date().toISOString()
        });
        console.log('[CleverTap] ✅ Test event sent successfully');
      } catch (testErr) {
        console.warn('[CleverTap] ⚠️ Test event failed:', testErr);
      }
    } else {
      console.error('[CleverTap] ❌ Initialization failed: event.push not available');
    }
  } catch (err) {
    console.error('[CleverTap] ❌ Initialization error:', err);
  }
} else {
  console.error('[CleverTap] ❌ Account ID is not set. Please set REACT_APP_CLEVERTAP_ACCOUNT_ID in your .env file');
  console.warn('[CleverTap] Runtime env check:', {
    accountId: process.env.REACT_APP_CLEVERTAP_ACCOUNT_ID,
    region: process.env.REACT_APP_CLEVERTAP_REGION
  });
}

export default clevertap;

