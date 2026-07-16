// src/context/AuthContext.tsx

import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';
import { useNavigate, useLocation } from 'react-router-dom';
import { setUserId, identify, Identify, reset } from '@amplitude/analytics-browser';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithPhoneNumber, RecaptchaVerifier, ConfirmationResult } from 'firebase/auth';
import { app as firebaseApp, initFirebaseAnalytics } from '../firebaseClient';
import clevertap from '../clevertapClient';
import { trackEvent } from '../utils/analytics';
import { amplitudeApp } from '../index';


export type PlanTier = 'free' | 'monthly' | 'yearly';
export type SubscriptionStatus = 'active' | 'cancelled' | 'past_due' | 'incomplete' | null;

const getCurrencyFromCountry = (countryCode: string) => {
  const code = countryCode.toUpperCase();
  if (code === 'IN') return 'INR';
  if (code === 'GB') return 'GBP';
  if (code === 'AE') return 'AED';
  if (code === 'EU' || ['DE', 'FR', 'IT', 'ES', 'NL'].includes(code)) return 'EUR';
  return 'USD';
};

interface UserProfile {
  id: string;
  name: string;
}

interface VerifyMsg91OtpPayload {
  accessToken: string;
  phone: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  variant: string;
}

interface PhoneOtpRequest {
  phone: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

interface PhoneOtpVerify extends PhoneOtpRequest {
  otp: string;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  isAdmin: boolean;
  isSubscribed: boolean;
  coinBalance: number | null;
  walletBalance: number | null;
  currency: string | null;
  updateWalletBalance: (newBalance: number) => void;
  fetchWalletBalanceFromDB: () => Promise<void>;
  planTier: PlanTier | null;
  subscriptionStatus: SubscriptionStatus;
  currentPeriodEnd: string | null;
  checkingStatus: boolean;
  userProfiles: UserProfile[] | null;
  signOut: () => void;
  signInWithGoogle: () => void;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, metadata?: { firstName?: string; lastName?: string }) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signInWithFirebaseGoogle: () => Promise<void>;
  refreshUserStatus: () => Promise<void>;
  updateCoinBalance: (newBalance: number) => void;
  requestPhoneOtp: (payload: PhoneOtpRequest) => Promise<void>;
  verifyPhoneOtp: (payload: PhoneOtpVerify) => Promise<void>;
  requestFirebasePhoneOtp: (payload: { phone: string; recaptchaVerifier: RecaptchaVerifier }) => Promise<ConfirmationResult>;
  verifyFirebasePhoneOtp: (payload: { confirmationResult: ConfirmationResult; otp: string; firstName?: string; lastName?: string; email?: string }) => Promise<void>;
  verifyMsg91Otp: (payload: VerifyMsg91OtpPayload) => Promise<void>;
  canAddProfile: boolean;
  pricingVariant: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [coinBalance, setCoinBalance] = useState<number | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [currency, setCurrency] = useState<string | null>(null);
  const [planTier, setPlanTier] = useState<PlanTier | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>(null);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | null>(null);
  const [userProfiles, setUserProfiles] = useState<UserProfile[] | null>(null);
  const [pricingVariant, setPricingVariant] = useState<string>('control');
  const MONETIZATION_FLAG_KEY = "pricingexperiment";


  const fetchUserStatus = useCallback(async (currentSession: Session | null) => {
    const currentUser = currentSession?.user ?? null;
    setSession(currentSession);
    setUser(currentUser);

    if (currentUser) {
      setCheckingStatus(true);
      setUserId(currentUser.id);

      // --- START: REVISED AND FINAL LOGIC ---

      const variantFromCreation = sessionStorage.getItem('variantAfterCreation');
      if (variantFromCreation) {
        // SCENARIO 1: A user was JUST created via phone.
        // We absolutely trust this variant. We don't even need to check the DB for the variant.
        console.log(`[AuthContext] Using locally trusted variant immediately after creation: ${variantFromCreation}`);
        setPricingVariant(variantFromCreation);
        sessionStorage.removeItem('variantAfterCreation'); // Clean up
      }

      // Now, fetch all other user data from the database.
      const [userDataRes, profilesDataRes] = await Promise.all([
        supabase.from('users')
          .select(`coin_balance, wallet_balance, currency_code, plan_tier, subscription_status, subscription_end_date, is_admin, phone_number, msg91_phone_number, email, pricing_variant`)
          .eq('id', currentUser.id)
          .single(),
        supabase.from('user_profiles').select('id, name').eq('user_id', currentUser.id)
      ]);

      const { data: userData } = userDataRes;
      const { data: profilesData } = profilesDataRes;

      if (!variantFromCreation) {
        // This block now ONLY runs if the user was NOT just created.
        if (userData?.pricing_variant) {
          // SCENARIO 2: A returning user with a variant already in the DB.
          console.log(`[AuthContext] Using stored variant from DB: ${userData.pricing_variant}`);
          setPricingVariant(userData.pricing_variant);
        } else if (userData) {
          // SCENARIO 3: An old user with no variant (backfill).
          console.log(`[AuthContext] Backfilling variant for existing user ${currentUser.id}...`);
          await amplitudeApp.experiment.fetch();
          const expVariant = amplitudeApp.experiment.variant(MONETIZATION_FLAG_KEY);
          const variantToSave = expVariant?.value || 'control';
          setPricingVariant(variantToSave);

          // Asynchronously save to DB
          supabase
            .from('users')
            .update({ pricing_variant: variantToSave })
            .eq('id', currentUser.id)
            .then(({ error }) => {
              if (error) {
                console.error('[AuthContext] CRITICAL: Error saving backfilled variant to DB:', error);
              } else {
                console.log(`[AuthContext] Successfully saved backfilled variant '${variantToSave}' for user.`);
              }
            });
        }
      }
      if (userData && !userData.currency_code) {
        console.log('User has no currency. Initializing wallet for OAuth user...');
        try {
          // For OAuth flows (like Google), the user has now been set.
          // The PricingContext's useEffect will now run and get the definitive variant.
          // We still need to call init-user-wallet, so we fetch the variant here one last time
          // to ensure the backend gets the correct value for user creation.
          await amplitudeApp.experiment.fetch();
          const expVariant = amplitudeApp.experiment.variant(MONETIZATION_FLAG_KEY);
          const variantName = expVariant?.value || 'control';

          console.log(`[AuthContext] Creating user with variant: ${variantName}.`);

          const { data: initData, error: initError } = await supabase.functions.invoke(
            'init-user-wallet',
            { body: { variant_name: variantName } }
          );

          if (!initError && initData?.success) {
            setCurrency(initData.currency);
            setWalletBalance(initData.balance);
            // Manually update local data to prevent layout shifts
            if (userData) {
              userData.currency_code = initData.currency;
              userData.wallet_balance = initData.balance;
            }
          } else {
            console.error("Failed to initialize user wallet:", initError);
            setCurrency('USD'); setWalletBalance(0);
          }
        } catch (e) {
          console.error("Error during wallet initialization with variant:", e);
          setCurrency('USD'); setWalletBalance(0);
        }
      } else if (userData) {
        setCurrency(userData.currency_code);
        setWalletBalance(userData.wallet_balance || 0);
      }

      const userProperties = new Identify();
      userProperties.set('email', currentUser.email ?? 'N/A');
      if (userData) {
        userProperties.set('plan_tier', userData.plan_tier ?? 'free');
        userProperties.set('subscription_status', userData.subscription_status ?? 'none');
        userProperties.set('coin_balance', userData.coin_balance ?? 0);
        userProperties.set('wallet_balance', userData.wallet_balance ?? 0);
        userProperties.set('currency', userData.currency_code ?? 'USD');
      }
      identify(userProperties);

      const phoneNumber = userData?.phone_number || userData?.msg91_phone_number || currentUser.phone;
      try {
        if (typeof clevertap.onUserLogin?.push === 'function') {
          clevertap.onUserLogin.push({
            Site: {
              Identity: currentUser.id,
              Email: currentUser.email ?? 'unknown',
              Phone: phoneNumber,
              'Plan Tier': userData?.plan_tier ?? 'free',
              'Wallet Balance': userData?.wallet_balance ?? 0,
              'Currency': userData?.currency_code ?? 'USD',
              'Subscription Status': userData?.subscription_status ?? 'none',
              
              'MSG-email': true,       // Enable email notifications
              'MSG-push': true,        // Enable push notifications
              'MSG-sms': true,         // Enable sms notifications
              'MSG-whatsapp': true     // Enable WhatsApp notifications
            }
          });
        }
      } catch (err) {
        console.error('[CleverTap] ❌ onUserLogin failed:', err);
      }

      setIsSubscribed(userData?.subscription_status === 'active');
      const email = (currentUser.email || '').toLowerCase();
      setIsAdmin(Boolean(userData?.is_admin) || ['shubhamkush012@gmail.com', 'vikram@stratnova.ai'].includes(email));
      setCoinBalance(userData?.coin_balance ?? 10);
      setPlanTier(userData?.plan_tier ?? 'free');
      setSubscriptionStatus(userData?.subscription_status ?? null);
      setCurrentPeriodEnd(userData?.subscription_end_date ?? null);
      setUserProfiles(profilesData || []);
      setCheckingStatus(false);
    } else {
      reset();
      setIsSubscribed(false);
      setIsAdmin(false);
      setCoinBalance(null);
      setWalletBalance(null);
      setCurrency(null);
      setPlanTier(null);
      setSubscriptionStatus(null);
      setCurrentPeriodEnd(null);
      setUserProfiles(null);
      setPricingVariant('control');
      setCheckingStatus(false);
    }
  }, []);

  const detectGuestLocation = async () => {
    try {
      const apiKey = process.env.REACT_APP_GEOAPIFY_API_KEY;
      if (apiKey) {
        const response = await fetch(`https://api.geoapify.com/v1/ipinfo?apiKey=${apiKey}`);
        if (response.ok) {
          const geoData = await response.json();
          const countryCode = geoData.country?.iso_code || 'US';
          const detectedCurrency = getCurrencyFromCountry(countryCode);
          setCurrency(detectedCurrency);
        }
      }
    } catch (error) {
      console.error('Guest location detection failed, defaulting to USD', error);
      setCurrency('USD');
    }
  };

  // --- EFFECT #1: Handles initial session loading and auth state changes ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      fetchUserStatus(session);
    }).finally(() => setLoading(false));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (_event === 'SIGNED_IN') {
        // A user returning from Google OAuth will have a hash in the URL.
        // A standard page refresh will not. This lets us differentiate.
        const isOAuthReturn = window.location.hash.includes('access_token');
        if (isOAuthReturn) {
          sessionStorage.setItem('justLoggedIn', 'true');
        }

        if (!sessionStorage.getItem('loginEventTracked')) {
          const loginMethod = session?.user?.app_metadata?.provider || (session?.user?.email ? 'email' : 'unknown');
          trackEvent('User Logged In', { login_method: loginMethod, user_id: session?.user?.id });
          sessionStorage.setItem('loginEventTracked', 'true');
        }
      }

      fetchUserStatus(session);

      if (!session) {
        detectGuestLocation();
      }
    });

    return () => subscription?.unsubscribe();
  }, [fetchUserStatus]);

  // --- EFFECT #2: Handles the one-time redirect after a user logs in ---
  useEffect(() => {
    if (!checkingStatus && user && userProfiles) {
      const justLoggedIn = sessionStorage.getItem('justLoggedIn');

      if (justLoggedIn === 'true') {
        sessionStorage.removeItem('justLoggedIn');

        if (userProfiles.length === 0) {
          navigate('/profiles/new');
        } else {
          navigate('/chat');
        }
      }
    }
  }, [checkingStatus, user, userProfiles, navigate]);

  // --- EFFECT #3: Refreshes user status when tab becomes visible ---
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        supabase.auth.getSession().then(({ data: { session } }) => {
          fetchUserStatus(session);
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchUserStatus]);


  const signInWithGoogle = async () => {
    trackEvent('Google Login Started', { method: 'supabase_oauth' });
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  };

  const signInWithEmail = async (email: string, password: string) => {
    trackEvent('Email Login Started', { method: 'supabase_password' });
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) throw new Error(error.message || 'Failed to sign in.');
    if (data?.session) {
      sessionStorage.setItem('justLoggedIn', 'true');
      await fetchUserStatus(data.session);
    }
  };

  const signUpWithEmail = async (
    email: string,
    password: string,
    metadata?: { firstName?: string; lastName?: string }
  ) => {
    trackEvent('Email Signup Started', { method: 'supabase_password' });
    const userData: Record<string, string> = {};
    if (metadata?.firstName) userData.first_name = metadata.firstName.trim();
    if (metadata?.lastName) userData.last_name = metadata.lastName.trim();

    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: Object.keys(userData).length > 0 ? userData : undefined,
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) throw new Error(error.message || 'Failed to sign up.');

    // With email confirmations disabled (see supabase/config.toml), signUp
    // returns an active session immediately. If confirmations get enabled later,
    // session will be null and the user must confirm via email first.
    if (data?.session) {
      sessionStorage.setItem('justLoggedIn', 'true');
      await fetchUserStatus(data.session);
    }
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/account`,
    });
    if (error) throw new Error(error.message || 'Failed to send reset email.');
  };

  const signInWithFirebaseGoogle = async () => {
    trackEvent('Google Login Started', { method: 'firebase_popup' });
    try {
      await initFirebaseAnalytics();
      const auth = getAuth(firebaseApp);
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const firebaseToken = await result.user.getIdToken();
      const { data, error } = await supabase.functions.invoke('firebase-auth-exchange-2', { body: { firebaseToken } });

      if (error) throw new Error('Failed to link Firebase account.');

      if (data?.session?.access_token) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
        if (sessionError) throw sessionError;

        sessionStorage.setItem('justLoggedIn', 'true');
        await fetchUserStatus(supabase.auth.getSession()?.data.session);

      } else if (data?.action_link) {
        window.location.href = data.action_link;
      } else {
        throw new Error('Firebase exchange returned no usable session data.');
      }
    } catch (e: any) {
      console.error('Firebase sign-in failed:', e);
      alert(`Firebase login failed: ${e.message}`);
    }
  };

  const requestPhoneOtp = async (payload: PhoneOtpRequest) => {
    try {
      const { phone, firstName, lastName, email } = payload;
      const sanitizedPhone = phone.trim();
      if (!sanitizedPhone.startsWith('+')) throw new Error('Phone number must include country code.');

      const userData: Record<string, string> = {};
      if (firstName) userData.first_name = firstName.trim();
      if (lastName) userData.last_name = lastName.trim();
      if (email) userData.email = email.trim();

      const { error } = await supabase.auth.signInWithOtp({
        phone: sanitizedPhone,
        options: { data: Object.keys(userData).length > 0 ? userData : undefined },
      });
      if (error) throw error;
    } catch (err: any) {
      throw new Error(err?.message || 'Failed to send OTP.');
    }
  };

  const verifyPhoneOtp = async (payload: PhoneOtpVerify) => {
    try {
      const { phone, otp, firstName, lastName, email } = payload;
      if (!phone.trim() || !otp.trim()) throw new Error('Phone and OTP are required.');

      const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
        phone: phone.trim(),
        token: otp.trim(),
        type: 'sms',
      });
      if (verifyError) throw verifyError;

      if (verifyData?.session) {
        const userMetadataUpdate: Record<string, string> = {};
        if (firstName?.trim()) userMetadataUpdate.first_name = firstName.trim();
        if (lastName?.trim()) userMetadataUpdate.last_name = lastName.trim();
        if (email?.trim()) userMetadataUpdate.email = email.trim();
        if (Object.keys(userMetadataUpdate).length > 0) {
          await supabase.auth.updateUser({ data: userMetadataUpdate });
        }

        sessionStorage.setItem('justLoggedIn', 'true');
        await fetchUserStatus(verifyData.session);
      }
    } catch (err: any) {
      throw new Error(err?.message || 'Failed to verify OTP.');
    }
  };

  const requestFirebasePhoneOtp = async (payload: { phone: string; recaptchaVerifier: RecaptchaVerifier }): Promise<ConfirmationResult> => {
    try {
      const { phone, recaptchaVerifier } = payload;
      if (!phone.trim().startsWith('+')) throw new Error('Phone number must include country code.');
      const auth = getAuth(firebaseApp);
      return await signInWithPhoneNumber(auth, phone.trim(), recaptchaVerifier);
    } catch (err: any) {
      throw new Error(err?.message || 'Failed to send OTP.');
    }
  };

  const verifyFirebasePhoneOtp = async (payload: { confirmationResult: ConfirmationResult; otp: string; firstName?: string; lastName?: string; email?: string }): Promise<void> => {
    try {
      const { confirmationResult, otp, firstName, lastName, email } = payload;
      if (!otp.trim()) throw new Error('OTP is required.');

      const result = await confirmationResult.confirm(otp.trim());
      if (!result.user) throw new Error('Firebase authentication failed.');

      const idToken = await result.user.getIdToken();
      const { data, error } = await supabase.functions.invoke('firebase-auth-exchange-2', { body: { firebaseToken: idToken } });
      if (error) throw error;

      if (data?.action_link) {
        const url = new URL(data.action_link);
        const tokenHash = url.searchParams.get('token_hash') || data.token_hash;
        if (tokenHash) {
          const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: data.type || 'recovery' });
          if (verifyError) throw verifyError;
          if (verifyData?.session) {
            const userMetadataUpdate: Record<string, string> = {};
            if (firstName?.trim()) userMetadataUpdate.first_name = firstName.trim();
            if (lastName?.trim()) userMetadataUpdate.last_name = lastName.trim();
            if (email?.trim()) userMetadataUpdate.email = email.trim();
            if (Object.keys(userMetadataUpdate).length > 0) {
              await supabase.auth.updateUser({ data: userMetadataUpdate });
            }
            sessionStorage.setItem('justLoggedIn', 'true');
            await fetchUserStatus(verifyData.session);
          }
        } else {
          throw new Error('No token hash received from Firebase exchange');
        }
      } else {
        throw new Error('No action link received from Firebase exchange');
      }
    } catch (err: any) {
      throw new Error(err?.message || 'Failed to verify OTP.');
    }
  };

  const verifyMsg91Otp = async (payload: VerifyMsg91OtpPayload) => {
    try {
      const { accessToken, phone, firstName, lastName, email, variant } = payload;
      if (!accessToken) throw new Error('Access token is required.');

      const finalVariant = variant || sessionStorage.getItem('guestVariant') || 'control';
      console.log(`[AuthContext-MSG91] User assigned to variant: ${finalVariant}. Verifying token.`);

      sessionStorage.setItem('variantAfterCreation', finalVariant);

      const normalizedPhone = phone.startsWith('+') ? phone.substring(1) : phone;
      const { data, error } = await supabase.functions.invoke('msg91-verify-token', {
        body: { access_token: accessToken, phone: normalizedPhone, firstName: firstName?.trim(), lastName: lastName?.trim(), email: email?.trim(), variant_name: finalVariant },
      });
      if (error) throw error;

      let tokenHash = data?.token_hash;
      if (!tokenHash && data?.action_link) {
        try {
          const url = new URL(data.action_link);
          tokenHash = url.searchParams.get('token_hash') || (url.hash && new URLSearchParams(url.hash.substring(1)).get('token_hash'));
        } catch { }
      }

      if (tokenHash) {
        const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: data.type || 'magiclink' });
        if (!verifyError && verifyData?.session) {
          const userMetadataUpdate: Record<string, string> = {};
          if (firstName?.trim()) userMetadataUpdate.first_name = firstName.trim();
          if (lastName?.trim()) userMetadataUpdate.last_name = lastName.trim();
          if (email?.trim()) userMetadataUpdate.email = email.trim();
          if (Object.keys(userMetadataUpdate).length > 0) {
            await supabase.auth.updateUser({ data: userMetadataUpdate });
          }
          sessionStorage.setItem('justLoggedIn', 'true');
          await fetchUserStatus(verifyData.session);
          return;
        }
      }

      if (data?.action_link) {
        window.location.href = data.action_link;
        return;
      }

      throw new Error('Verification failed.');
    } catch (err: any) {
      throw new Error(err?.message || 'Failed to verify OTP.');
    }
  };

  const signOut = async () => {
    trackEvent('User Logged Out');
    sessionStorage.removeItem('loginEventTracked');
    sessionStorage.removeItem('justLoggedIn'); // Clear the flag on sign out
    await supabase.auth.signOut();
    navigate('/');
  };

  const updateWalletBalance = useCallback((newBalance: number) => setWalletBalance(newBalance), []);
  const updateCoinBalance = useCallback((newBalance: number) => setCoinBalance(newBalance), []);

  // Fetch wallet_balance directly from database in real-time
  const fetchWalletBalanceFromDB = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('users')
        .select('wallet_balance')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching wallet balance:', error);
        return;
      }

      if (data) {
        setWalletBalance(data.wallet_balance ?? 0);
        console.log('✅ Wallet balance refreshed from DB:', data.wallet_balance);
      }
    } catch (err) {
      console.error('Error in fetchWalletBalanceFromDB:', err);
    }
  }, [user?.id]);

  let profileLimit = 1;
  if (planTier === 'yearly') profileLimit = 10;
  if (planTier === 'monthly') profileLimit = 4;
  const canAddProfile = userProfiles ? userProfiles.length < profileLimit : false;

  const value = {
    session, user, isAdmin, isSubscribed, coinBalance, planTier,
    subscriptionStatus, currentPeriodEnd, checkingStatus, walletBalance,
    currency, updateWalletBalance, fetchWalletBalanceFromDB, userProfiles, signOut, signInWithGoogle,
    signInWithEmail, signUpWithEmail, resetPassword,
    signInWithFirebaseGoogle, refreshUserStatus: () => supabase.auth.getSession().then(({ data }) => fetchUserStatus(data.session)),
    updateCoinBalance, requestPhoneOtp, verifyPhoneOtp, requestFirebasePhoneOtp,
    verifyFirebasePhoneOtp, verifyMsg91Otp, canAddProfile, pricingVariant,
  };

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};