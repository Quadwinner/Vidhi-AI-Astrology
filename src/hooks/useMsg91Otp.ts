import { useEffect, useRef, useState, useCallback } from 'react';

declare global {
  interface Window {
    msg91ScriptLoaded?: boolean;
    initSendOTP?: (config: any) => void;
    sendOtp?: (identifier: string, success?: (data: any) => void, failure?: (error: any) => void) => void;
    retryOtp?: (channel: string | null, success?: (data: any) => void, failure?: (error: any) => void, reqId?: string) => void;
    verifyOtp?: (otp: string, success?: (data: any) => void, failure?: (error: any) => void, reqId?: string) => void;
    getWidgetData?: () => any;
    isCaptchaVerified?: () => boolean;
  }
}

interface Msg91Config {
  widgetId: string;
  tokenAuth: string;
  identifier?: string;
  exposeMethods?: boolean;
  captchaRenderId?: string;
  success?: (data: any) => void;
  failure?: (error: any) => void;
}

/**
 * Wait for MSG91 script to be available.
 * The script is loaded via <script> tag in index.html to avoid CORS issues.
 * This function simply waits for window.initSendOTP to be available.
 */
const waitForMsg91Script = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    console.log('[MSG91 Hook] Checking if script is loaded...');
    
    // Check if already loaded
    if (window.initSendOTP) {
      console.log('[MSG91 Hook] ✓ Script already loaded');
      resolve();
      return;
    }

    // Wait for script to load (max 15 seconds)
    let attempts = 0;
    const maxAttempts = 75; // 15 seconds (75 * 200ms)
    
    const checkInterval = setInterval(() => {
      attempts++;
      
      if (window.initSendOTP) {
        console.log(`[MSG91 Hook] ✓ Script loaded after ${attempts * 200}ms`);
        clearInterval(checkInterval);
        resolve();
      } else if (attempts >= maxAttempts) {
        console.error('[MSG91 Hook] ❌ Script load timeout after 15 seconds');
        clearInterval(checkInterval);
        reject(new Error('MSG91 script failed to load. Check if script tag is present in index.html'));
      } else if (attempts % 10 === 0) {
        console.log(`[MSG91 Hook] Waiting for script... (${attempts * 200}ms)`);
      }
    }, 200);
  });
};

export const useMsg91Otp = (config: Msg91Config | null) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const configRef = useRef(config);
  const initializedRef = useRef(false);

  // Update config ref when it changes
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    // Don't initialize if config is null or invalid
    if (!config || !config.widgetId || !config.tokenAuth) {
      return;
    }

    let isMounted = true;

      const initializeWidget = async () => {
        try {
          // Wait for script to be available (loaded from index.html)
          await waitForMsg91Script();
        
        if (!isMounted) return;

        setIsLoaded(true);

        // Wait for DOM to be ready
        await new Promise(resolve => setTimeout(resolve, 300));
        
        if (!isMounted) return;

        // Check if captcha container exists (if captchaRenderId is provided)
        // Note: Container might not exist yet if modal hasn't rendered, that's okay
        if (configRef.current?.captchaRenderId) {
          const captchaContainer = document.getElementById(configRef.current.captchaRenderId);
          if (!captchaContainer) {
            console.log('[MSG91] Captcha container not found yet (will be created when modal opens)');
          } else {
            console.log('[MSG91] Captcha container found');
          }
        }

        // Initialize widget only once
        if (window.initSendOTP && !initializedRef.current) {
          try {
            // If captchaRenderId is provided, ensure container exists
            if (configRef.current?.captchaRenderId) {
              let attempts = 0;
              while (attempts < 10) {
                const container = document.getElementById(configRef.current.captchaRenderId);
                if (container) {
                  console.log('[MSG91] Captcha container found, proceeding with initialization');
                  break;
                }
                console.log(`[MSG91] Waiting for captcha container (attempt ${attempts + 1}/10)...`);
                await new Promise(resolve => setTimeout(resolve, 500));
                attempts++;
              }
              
              if (!document.getElementById(configRef.current.captchaRenderId)) {
                console.warn('[MSG91] Captcha container not found, but proceeding anyway');
              }
            }
            
            console.log('[MSG91] Attempting to initialize widget with config:', {
              widgetId: configRef.current?.widgetId,
              hasCaptchaRenderId: !!configRef.current?.captchaRenderId,
              exposeMethods: configRef.current?.exposeMethods
            });
            
            // Call initSendOTP
            window.initSendOTP(configRef.current);
            initializedRef.current = true;
            
            // Wait for widget to fully set up and expose methods
            // Poll for methods to be available
            let pollAttempts = 0;
            while (pollAttempts < 20) {
              await new Promise(resolve => setTimeout(resolve, 200));
              
              if (window.sendOtp && window.verifyOtp) {
                console.log('[MSG91] Widget initialized successfully, methods exposed');
                setIsInitialized(true);
                return;
              }
              
              pollAttempts++;
            }
            
            // If we get here, methods weren't exposed
            console.warn('[MSG91] Widget initialized but methods not exposed after waiting');
            // Still set as initialized if initSendOTP was called successfully
            // The methods might be available later when the modal opens
            setIsInitialized(true);
          } catch (err: any) {
            console.error('[MSG91] Initialization error:', err);
            if (isMounted) {
              setError(err.message || 'Failed to initialize MSG91 widget');
            }
          }
        } else if (window.initSendOTP && initializedRef.current) {
          // Already initialized, just check if methods are available
          if (window.sendOtp && window.verifyOtp) {
            setIsInitialized(true);
          }
        } else if (!window.initSendOTP) {
          console.error('[MSG91] initSendOTP function not available on window');
          if (isMounted) {
            setError('MSG91 widget functions not available. Please refresh the page.');
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Failed to load MSG91 widget script');
        }
      }
    };

    initializeWidget();

    return () => {
      isMounted = false;
    };
  }, [config]); // Only re-run if config changes

  const sendOtp = (identifier: string): Promise<any> => {
    return new Promise((resolve, reject) => {
      if (!window.sendOtp) {
        reject(new Error('MSG91 sendOtp method not available. Please wait for widget to initialize.'));
        return;
      }

      // Add a small delay to ensure widget is ready
      setTimeout(() => {
        try {
          window.sendOtp(
            identifier,
            (data) => {
              resolve(data);
            },
            (error) => {
              reject(error);
            }
          );
        } catch (err: any) {
          reject(new Error(err?.message || 'Failed to send OTP. Please ensure captcha is verified.'));
        }
      }, 100);
    });
  };

  const retryOtp = (channel: string | null = null, reqId?: string): Promise<any> => {
    return new Promise((resolve, reject) => {
      if (!window.retryOtp) {
        reject(new Error('MSG91 retryOtp method not available'));
        return;
      }

      window.retryOtp(
        channel,
        (data) => {
          resolve(data);
        },
        (error) => {
          reject(error);
        },
        reqId
      );
    });
  };

  const verifyOtp = (otp: string, reqId?: string): Promise<any> => {
    return new Promise((resolve, reject) => {
      if (!window.verifyOtp) {
        reject(new Error('MSG91 verifyOtp method not available'));
        return;
      }

      window.verifyOtp(
        otp,
        (data) => {
          resolve(data);
        },
        (error) => {
          reject(error);
        },
        reqId
      );
    });
  };

  const getWidgetData = () => {
    if (window.getWidgetData) {
      return window.getWidgetData();
    }
    return null;
  };

  const isCaptchaVerified = () => {
    if (window.isCaptchaVerified) {
      return window.isCaptchaVerified();
    }
    return false;
  };

  return {
    isLoaded,
    isInitialized,
    error,
    sendOtp,
    retryOtp,
    verifyOtp,
    getWidgetData,
    isCaptchaVerified,
  };
};

