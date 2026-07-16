import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ConfirmationResult, RecaptchaVerifier } from 'firebase/auth';
import { useAuth } from '../context/AuthContext';
import { trackEvent } from '../utils/analytics';
import './AuthModal.css';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Legacy props kept optional for backward compatibility with existing callers.
  // Auth is now driven entirely through AuthContext (email + Google).
  onGoogleSignIn?: () => void;
  phoneAuth?: {
    requestOtp: (payload: { phone: string }) => Promise<void>;
    verifyOtp: (payload: { phone: string; otp: string }) => Promise<void>;
  };
  firebasePhoneAuth?: {
    requestOtp: (payload: { phone: string; recaptchaVerifier: RecaptchaVerifier }) => Promise<ConfirmationResult>;
    verifyOtp: (payload: { confirmationResult: ConfirmationResult; otp: string }) => Promise<void>;
  };
  msg91Auth?: {
    verifyOtp: (payload: { accessToken: string; phone: string; whatsappMarketingOptIn?: boolean }) => Promise<void>;
  };
}

type AuthMode = 'signin' | 'signup' | 'reset';

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { signInWithEmail, signUpWithEmail, resetPassword, signInWithGoogle } = useAuth();

  const [mode, setMode] = useState<AuthMode>('signin');
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Reset the form whenever the modal is closed.
  useEffect(() => {
    if (!isOpen) {
      setMode('signin');
      setFirstName('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setShowPassword(false);
      setError(null);
      setInfo(null);
      setIsLoading(false);
    }
  }, [isOpen]);

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError(null);
    setInfo(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setIsLoading(true);
    try {
      if (mode === 'reset') {
        await resetPassword(email);
        setInfo('If an account exists for this email, a password reset link is on its way.');
      } else if (mode === 'signup') {
        if (password.length < 6) {
          setError('Password must be at least 6 characters.');
          setIsLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          setError('Passwords do not match.');
          setIsLoading(false);
          return;
        }
        await signUpWithEmail(email, password, { firstName });
        onClose();
      } else {
        await signInWithEmail(email, password);
        onClose();
      }
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    trackEvent('Google Login Clicked', { source: 'auth_modal' });
    try {
      // Redirects the browser to Google; the page will navigate away.
      await signInWithGoogle();
    } catch (err: any) {
      setError(err?.message || 'Google sign-in failed. Please try again.');
    }
  };

  if (!isOpen) return null;

  const title =
    mode === 'signup' ? 'Create your account'
    : mode === 'reset' ? 'Reset your password'
    : 'Sign in to continue';

  const submitLabel =
    mode === 'signup' ? (isLoading ? 'Creating account…' : 'Create account')
    : mode === 'reset' ? (isLoading ? 'Sending…' : 'Send reset link')
    : (isLoading ? 'Signing in…' : 'Sign in');

  return createPortal(
    <div className="auth-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="auth-modal-container">
        {/* Left Panel - Features */}
        <div className="auth-features-panel">
          <div className="auth-features-content">
            <div className="auth-star-decoration">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M24 0L27.5 16.5L44 20L27.5 23.5L24 40L20.5 23.5L4 20L20.5 16.5L24 0Z" fill="url(#star-gradient)"/>
                <defs>
                  <linearGradient id="star-gradient" x1="4" y1="0" x2="44" y2="40" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#ED0687"/>
                    <stop offset="1" stopColor="#FE6C0F"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>

            <h2 className="auth-welcome-title">Welcome to Your Cosmic Journey</h2>
            <p className="auth-welcome-subtitle">
              Discover personalized astrology insights powered by AI
            </p>

            <div className="auth-feature-cards">
              <div className="auth-feature-card">
                <div className="auth-feature-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="url(#icon-gradient)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <defs>
                      <linearGradient id="icon-gradient" x1="2" y1="2" x2="22" y2="21" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#ED0687"/>
                        <stop offset="1" stopColor="#FE6C0F"/>
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <div className="auth-feature-text">
                  <h3>AI-Powered Astrology</h3>
                  <p>Get instant, accurate predictions powered by advanced AI</p>
                </div>
              </div>

              <div className="auth-feature-card">
                <div className="auth-feature-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="3" y="11" width="18" height="11" rx="2" stroke="url(#icon-gradient-2)" strokeWidth="2"/>
                    <path d="M7 11V7C7 4.79086 8.79086 3 11 3H13C15.2091 3 17 4.79086 17 7V11" stroke="url(#icon-gradient-2)" strokeWidth="2" strokeLinecap="round"/>
                    <circle cx="12" cy="16" r="1" fill="url(#icon-gradient-2)"/>
                    <defs>
                      <linearGradient id="icon-gradient-2" x1="3" y1="3" x2="21" y2="22" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#ED0687"/>
                        <stop offset="1" stopColor="#FE6C0F"/>
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <div className="auth-feature-text">
                  <h3>100% Privacy</h3>
                  <p>Your data is secure and never shared with third parties</p>
                </div>
              </div>

              <div className="auth-feature-card">
                <div className="auth-feature-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" stroke="url(#icon-gradient-3)" strokeWidth="2"/>
                    <path d="M8 14C8 14 9.5 16 12 16C14.5 16 16 14 16 14" stroke="url(#icon-gradient-3)" strokeWidth="2" strokeLinecap="round"/>
                    <circle cx="9" cy="9" r="1" fill="url(#icon-gradient-3)"/>
                    <circle cx="15" cy="9" r="1" fill="url(#icon-gradient-3)"/>
                    <defs>
                      <linearGradient id="icon-gradient-3" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#ED0687"/>
                        <stop offset="1" stopColor="#FE6C0F"/>
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <div className="auth-feature-text">
                  <h3>Happy Customers</h3>
                  <p>Join thousands of satisfied users on their cosmic journey</p>
                </div>
              </div>
            </div>

            <div className="auth-rating">
              <div className="auth-stars">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M10 0L12.5758 6.90983L20 8.09017L15 13.0902L16.1803 20.5L10 17.0902L3.81966 20.5L5 13.0902L0 8.09017L7.42417 6.90983L10 0Z" fill="#FFB800"/>
                  </svg>
                ))}
              </div>
              <span className="auth-rating-text">4.8/5 from 10,000+ users</span>
            </div>
          </div>

          <div className="auth-blob auth-blob-1"></div>
          <div className="auth-blob auth-blob-2"></div>
        </div>

        {/* Right Panel - Auth Form */}
        <div className="auth-form-panel">
          <button className="auth-close-button" onClick={onClose} aria-label="Close">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18M6 6L18 18" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          <div className="auth-form-content">
            {mode !== 'reset' && (
              <div className="auth-mode-tabs">
                <button
                  type="button"
                  className={`auth-mode-tab ${mode === 'signin' ? 'active' : ''}`}
                  onClick={() => switchMode('signin')}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  className={`auth-mode-tab ${mode === 'signup' ? 'active' : ''}`}
                  onClick={() => switchMode('signup')}
                >
                  Sign Up
                </button>
              </div>
            )}

            <h3 className="auth-form-title">{title}</h3>

            {error && <div className="auth-error-message">{error}</div>}
            {info && <div className="auth-success-message">{info}</div>}

            <form onSubmit={handleSubmit} className="auth-form">
              {mode === 'signup' && (
                <div className="auth-input-group">
                  <label htmlFor="auth-firstname" className="auth-label">Name</label>
                  <input
                    id="auth-firstname"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Your name"
                    className="auth-text-input"
                    autoComplete="given-name"
                  />
                </div>
              )}

              <div className="auth-input-group">
                <label htmlFor="auth-email" className="auth-label">Email*</label>
                <input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="auth-text-input"
                  autoComplete="email"
                  required
                />
              </div>

              {mode !== 'reset' && (
                <div className="auth-input-group">
                  <label htmlFor="auth-password" className="auth-label">Password*</label>
                  <div className="auth-password-row">
                    <input
                      id="auth-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={mode === 'signup' ? 'At least 6 characters' : 'Your password'}
                      className="auth-text-input"
                      autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                      required
                    />
                    <button
                      type="button"
                      className="auth-password-toggle"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
              )}

              {mode === 'signup' && (
                <div className="auth-input-group">
                  <label htmlFor="auth-confirm" className="auth-label">Confirm password*</label>
                  <input
                    id="auth-confirm"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password"
                    className="auth-text-input"
                    autoComplete="new-password"
                    required
                  />
                </div>
              )}

              {mode === 'signin' && (
                <div style={{ textAlign: 'right', marginTop: '-0.25rem', marginBottom: '0.5rem' }}>
                  <button type="button" className="auth-link-button" onClick={() => switchMode('reset')}>
                    Forgot password?
                  </button>
                </div>
              )}

              <button type="submit" className="auth-send-otp-button" disabled={isLoading}>
                {submitLabel}
              </button>
            </form>

            {mode === 'reset' ? (
              <button type="button" className="auth-link-button" style={{ marginTop: '1rem' }} onClick={() => switchMode('signin')}>
                ← Back to sign in
              </button>
            ) : (
              <>
                <div className="auth-divider"><span>or</span></div>

                <button type="button" className="auth-google-button" onClick={handleGoogle}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '8px' }}>
                    <path d="M19.6 10.227c0-.709-.064-1.39-.182-2.045H10v3.868h5.382a4.6 4.6 0 01-1.996 3.018v2.51h3.232c1.891-1.742 2.982-4.305 2.982-7.35z" fill="#4285F4"/>
                    <path d="M10 20c2.7 0 4.964-.895 6.618-2.423l-3.232-2.509c-.895.6-2.04.955-3.386.955-2.605 0-4.81-1.76-5.595-4.123H1.064v2.59A9.996 9.996 0 0010 20z" fill="#34A853"/>
                    <path d="M4.405 11.9c-.2-.6-.314-1.24-.314-1.9 0-.66.114-1.3.314-1.9V5.51H1.064A9.996 9.996 0 000 10c0 1.614.386 3.14 1.064 4.49l3.34-2.59z" fill="#FBBC05"/>
                    <path d="M10 3.977c1.468 0 2.786.505 3.823 1.496l2.868-2.868C14.959.99 12.695 0 10 0 6.09 0 2.71 2.24 1.064 5.51l3.34 2.59C5.19 5.736 7.395 3.977 10 3.977z" fill="#EA4335"/>
                  </svg>
                  Continue with Google
                </button>

                <p className="auth-terms">
                  By continuing, you agree to our <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default AuthModal;
