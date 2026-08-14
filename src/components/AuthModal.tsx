import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { ConfirmationResult, RecaptchaVerifier } from 'firebase/auth';
import { useAuth } from '../context/AuthContext';
import { trackEvent } from '../utils/analytics';
import './AuthModal.css';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
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

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

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
    mode === 'signup' ? (isLoading ? 'Creating account…' : 'Begin journey')
    : mode === 'reset' ? (isLoading ? 'Sending…' : 'Send reset link')
    : (isLoading ? 'Signing in…' : 'Enter sanctuary');

  const submitIcon =
    mode === 'signup' ? 'auto_awesome' : mode === 'reset' ? 'outgoing_mail' : 'arrow_forward';

  return createPortal(
    <div className="auth-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="auth-modal-container"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-form-title"
      >
        <div className="auth-glow" aria-hidden="true" />

        <button className="auth-close-button" onClick={onClose} aria-label="Close">
          <span className="material-symbols-outlined" aria-hidden="true">close</span>
        </button>

        <div className="auth-modal-head">
          <h2 className="auth-brand">Vidhi AI</h2>
          <p className="auth-brand-sub">Unlock your celestial potential.</p>
        </div>

        {mode !== 'reset' && (
          <div className="auth-mode-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signin'}
              className={`auth-mode-tab ${mode === 'signin' ? 'active' : ''}`}
              onClick={() => switchMode('signin')}
            >
              Sign In
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signup'}
              className={`auth-mode-tab ${mode === 'signup' ? 'active' : ''}`}
              onClick={() => switchMode('signup')}
            >
              Sign Up
            </button>
          </div>
        )}

        <div className="auth-form-content">
          <h3 className="auth-form-title" id="auth-form-title">{title}</h3>

          {error && <div className="auth-error-message" role="alert">{error}</div>}
          {info && <div className="auth-success-message" role="status">{info}</div>}

          <form onSubmit={handleSubmit} className="auth-form">
            {mode === 'signup' && (
              <div className="auth-input-group">
                <label htmlFor="auth-firstname" className="auth-label">Full name</label>
                <div className="auth-field">
                  <span className="material-symbols-outlined" aria-hidden="true">person</span>
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
              </div>
            )}

            <div className="auth-input-group">
              <label htmlFor="auth-email" className="auth-label">Email address</label>
              <div className="auth-field">
                <span className="material-symbols-outlined" aria-hidden="true">mail</span>
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
            </div>

            {mode !== 'reset' && (
              <div className="auth-input-group">
                <div className="auth-label-row">
                  <label htmlFor="auth-password" className="auth-label">Password</label>
                  {mode === 'signin' && (
                    <button type="button" className="auth-link-button" onClick={() => switchMode('reset')}>
                      Forgot?
                    </button>
                  )}
                </div>
                <div className="auth-field auth-has-toggle">
                  <span className="material-symbols-outlined" aria-hidden="true">lock</span>
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
                <label htmlFor="auth-confirm" className="auth-label">Confirm password</label>
                <div className="auth-field">
                  <span className="material-symbols-outlined" aria-hidden="true">lock_reset</span>
                  <input
                    id="auth-confirm"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    className="auth-text-input"
                    autoComplete="new-password"
                    required
                  />
                </div>
              </div>
            )}

            <button type="submit" className="auth-submit-button" disabled={isLoading}>
              {submitLabel}
              <span className="material-symbols-outlined" aria-hidden="true">{submitIcon}</span>
            </button>
          </form>

          {mode === 'reset' ? (
            <button
              type="button"
              className="auth-link-button auth-back-button"
              onClick={() => switchMode('signin')}
            >
              ← Back to sign in
            </button>
          ) : (
            <>
              <div className="auth-divider"><span>or</span></div>

              <button type="button" className="auth-google-button" onClick={handleGoogle}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M19.6 10.227c0-.709-.064-1.39-.182-2.045H10v3.868h5.382a4.6 4.6 0 01-1.996 3.018v2.51h3.232c1.891-1.742 2.982-4.305 2.982-7.35z" fill="#4285F4"/>
                  <path d="M10 20c2.7 0 4.964-.895 6.618-2.423l-3.232-2.509c-.895.6-2.04.955-3.386.955-2.605 0-4.81-1.76-5.595-4.123H1.064v2.59A9.996 9.996 0 0010 20z" fill="#34A853"/>
                  <path d="M4.405 11.9c-.2-.6-.314-1.24-.314-1.9 0-.66.114-1.3.314-1.9V5.51H1.064A9.996 9.996 0 000 10c0 1.614.386 3.14 1.064 4.49l3.34-2.59z" fill="#FBBC05"/>
                  <path d="M10 3.977c1.468 0 2.786.505 3.823 1.496l2.868-2.868C14.959.99 12.695 0 10 0 6.09 0 2.71 2.24 1.064 5.51l3.34 2.59C5.19 5.736 7.395 3.977 10 3.977z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>

              <p className="auth-terms">
                By continuing, you agree to our{' '}
                <Link to="/terms-and-conditions" onClick={onClose}>Terms</Link> and{' '}
                <Link to="/privacy-policy" onClick={onClose}>Privacy Policy</Link>
              </p>
            </>
          )}
        </div>

        <div className="auth-accent-bar" aria-hidden="true" />
      </div>
    </div>,
    document.body
  );
};

export default AuthModal;
