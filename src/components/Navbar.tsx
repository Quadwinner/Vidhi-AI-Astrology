import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePricing } from '../context/PricingContext'; // Import Pricing Context
import './Navbar.css';

import { IconChevronDown, IconMessageCircle, IconUser, IconWallet, IconLogout } from '@tabler/icons-react';
import AuthModal from './AuthModal';
import CustomLanguageSelector from './CustomLanguageSelector';
import GoogleTranslateWidget from './GoogleTranslateWidget';

const Navbar: React.FC = () => {
  const {
    user,
    signOut,
    signInWithFirebaseGoogle,
    planTier,
    walletBalance, // Changed from coinBalance
    requestPhoneOtp,
    verifyPhoneOtp,
    requestFirebasePhoneOtp,
    verifyFirebasePhoneOtp,
    verifyMsg91Otp
  } = useAuth();

  const { formatPrice, isLoading: isPricingLoading } = usePricing(); // Get formatter
  const navigate = useNavigate();

  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [isLearnMoreOpen, setIsLearnMoreOpen] = useState<boolean>(false);
  const [isToolsOpen, setIsToolsOpen] = useState<boolean>(false);
  const [isMobilePricingOpen, setIsMobilePricingOpen] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const toolsRef = useRef<HTMLDivElement | null>(null);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);

  // ... (Keep existing useEffects for closing menus/scroll lock unchanged) ...
  useEffect(() => {
    if (!isLearnMoreOpen) return;
    const handleDocClick = (e: MouseEvent) => {
      if (!dropdownRef.current) return;
      const target = e.target as Node;
      if (!dropdownRef.current.contains(target)) {
        setIsLearnMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', handleDocClick);
    return () => document.removeEventListener('mousedown', handleDocClick);
  }, [isLearnMoreOpen]);

  useEffect(() => {
    if (!isToolsOpen) return;
    const handleDocClick = (e: MouseEvent) => {
      if (!toolsRef.current) return;
      if (!toolsRef.current.contains(e.target as Node)) setIsToolsOpen(false);
    };
    document.addEventListener('mousedown', handleDocClick);
    return () => document.removeEventListener('mousedown', handleDocClick);
  }, [isToolsOpen]);

  const closeAllMenus = () => {
    setIsMenuOpen(false);
    setIsMobilePricingOpen(false);
  };

  React.useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMenuOpen]);

  React.useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        const hamburgerButton = document.querySelector('.hamburger-menu');
        if (hamburgerButton && !hamburgerButton.contains(e.target as Node)) {
          closeAllMenus();
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  const userAvatarUrl = user?.user_metadata?.avatar_url;
  const userName = user?.user_metadata?.full_name || 'User';

  const getStatusText = () => {
    if (planTier === 'monthly' || planTier === 'yearly') {
      return 'Premium Member';
    }
    return 'Free Tier';
  };

  const handleAuthRedirect = (e: React.MouseEvent) => {
    if (!user) {
      e.preventDefault();
      closeAllMenus();
      setIsAuthModalOpen(true);
    } else {
      closeAllMenus();
    }
  };

  const phoneAuthHandlers = useMemo(() => ({
    requestOtp: requestPhoneOtp,
    verifyOtp: verifyPhoneOtp,
  }), [requestPhoneOtp, verifyPhoneOtp]);

  const firebasePhoneAuthHandlers = useMemo(() => ({
    requestOtp: requestFirebasePhoneOtp,
    verifyOtp: verifyFirebasePhoneOtp,
  }), [requestFirebasePhoneOtp, verifyFirebasePhoneOtp]);

  const msg91AuthHandlers = useMemo(() => ({
    verifyOtp: verifyMsg91Otp,
  }), [verifyMsg91Otp]);

  // Helper to safely render balance
  const renderBalance = () => {
    if (isPricingLoading || walletBalance === null) return '...';
    return formatPrice(walletBalance);
  };

  return (
    <>
      <nav className="navbar-container">
        <div className="navbar-group-left">
          <Link to="/" className="navbar-logo" aria-label="Vidhi home">
            <span className="logo-emblem">
              <svg viewBox="0 0 24 24" width="34" height="34" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M12.1818 2.05459C12.4437 2.03606 12.6934 2.14819 12.8631 2.34836C13.0327 2.54854 13.097 2.8087 13.0387 3.06456C12.383 5.92984 13.4357 8.94901 15.6568 10.7417C17.8778 12.5343 20.9324 12.8465 23.4478 11.5369C23.6706 11.4191 23.9351 11.4552 24.123 11.6289C24.3108 11.8026 24.3855 12.0805 24.3138 12.3364C23.0039 17.0601 18.5772 20.4842 13.5 20.4842C7.14873 20.4842 2 15.3354 2 8.98418C2 5.09311 4.10398 1.68817 7.42084 0.170607C7.65342 0.0603831 7.92506 0.113038 8.11322 0.304561C8.30137 0.496084 8.37346 0.793744 8.29656 1.06368C7.6322 3.39349 8.15174 5.92953 9.77443 7.71261C11.3971 9.4957 13.9103 10.2796 16.3533 9.7667C15.9388 9.53932 15.5401 9.27854 15.1618 8.98418C12.222 6.64334 10.963 2.53034 12.1818 2.05459Z" fill="currentColor" />
                <path d="M19.5 2.5L20.1633 4.83669L22.5 5.5L20.1633 6.16331L19.5 8.5L18.8367 6.16331L16.5 5.5L18.8367 4.83669L19.5 2.5Z" fill="currentColor" />
              </svg>
            </span>
            <div className="logo-text">Vidhi</div>
          </Link>
        </div>

        <div className="navbar-group-right">
          <div className="nav-links-group">
            {/* <Link to="/" className="nav-link">Home</Link> */}
            
            <Link to="/reports#ai" className="nav-link" onClick={handleAuthRedirect}>Reports</Link>
            <Link to="/reports#tables" className="nav-link" onClick={handleAuthRedirect}>Birth Chart</Link>
            <Link to="/chat" className="nav-link" onClick={handleAuthRedirect}>Chat</Link>
            <Link to="/chat?startCall=1" className="nav-link" onClick={handleAuthRedirect}>Call</Link>
            <Link to="/remedies" className="nav-link" onClick={handleAuthRedirect}>Remedies</Link>
            <Link to="/rashifal" className="nav-link">Rashifal</Link>
            <Link to="/tarot" className="nav-link">Tarot</Link>
            <div className="nav-dropdown" ref={toolsRef}>
              <button
                className="nav-dropdown-toggle"
                onClick={() => setIsToolsOpen(!isToolsOpen)}
                aria-haspopup="true"
                aria-expanded={isToolsOpen}
              >
                Astrology
                <IconChevronDown size={16} className={`dropdown-arrow ${isToolsOpen ? 'open' : ''}`} />
              </button>
              {isToolsOpen && (
                <div className="nav-dropdown-menu">
                  <Link to="/kundli-matching" className="nav-dropdown-item" onClick={() => setIsToolsOpen(false)}>Kundli Matching</Link>
                  <Link to="/panchang" className="nav-dropdown-item" onClick={() => setIsToolsOpen(false)}>Panchang</Link>
                  <Link to="/doshas" className="nav-dropdown-item" onClick={() => setIsToolsOpen(false)}>Doshas</Link>
                  <Link to="/numerology" className="nav-dropdown-item" onClick={() => setIsToolsOpen(false)}>Numerology</Link>
                  <Link to="/gemstones" className="nav-dropdown-item" onClick={() => setIsToolsOpen(false)}>Gemstones</Link>
                </div>
              )}
            </div>
            <div className="nav-dropdown" ref={dropdownRef}>
              <button
                className="nav-dropdown-toggle"
                onClick={() => setIsLearnMoreOpen(!isLearnMoreOpen)}
                aria-haspopup="true"
                aria-expanded={isLearnMoreOpen}
              >
                Learn More
                <IconChevronDown
                  size={16}
                  className={`dropdown-arrow ${isLearnMoreOpen ? 'open' : ''}`}
                />
              </button>
              {isLearnMoreOpen && (
                <div className="nav-dropdown-menu">
                  <Link to="/#pricing" className="nav-dropdown-item" onClick={() => setIsLearnMoreOpen(false)}>Pricing Details</Link>
                  <Link to="/how-it-works" className="nav-dropdown-item" onClick={() => setIsLearnMoreOpen(false)}>How it works</Link>
                  <Link to="/blog" className="nav-dropdown-item" onClick={() => setIsLearnMoreOpen(false)}>Blog</Link>
                </div>
              )}
            </div>

          </div>

          {user ? (
            <>
              <div className="user-actions-group">
                <button
                  type="button"
                  className="wallet-pill"
                  onClick={() => navigate('/wallet')}
                  aria-label="Open Wallet"
                >
                  <IconWallet size={16} />
                  {/* UPDATED: Uses formatPrice now */}
                  <span className="wallet-text">{renderBalance()}</span>
                </button>
                <div className="navbar-user-info">
                  <Link to="/profiles" className="profile-avatar">
                    {userAvatarUrl ? (
                      <img src={userAvatarUrl} alt={userName} className="profile-avatar-image" />
                    ) : (
                      <div className="profile-avatar-icon"><IconUser size={20} /></div>
                    )}
                  </Link>
                  <Link to="/profiles" className="user-texts">
                    <div className="user-name">{userName}</div>
                    <div className="user-status">{getStatusText()}</div>
                  </Link>
                </div>
                <button
                  type="button"
                  className="signout-btn"
                  onClick={() => { signOut(); closeAllMenus(); }}
                  aria-label="Sign out"
                  title="Sign out"
                >
                  <IconLogout size={18} />
                </button>
              </div>

              <div className="language-tools-group">
                <GoogleTranslateWidget />
                <CustomLanguageSelector />
              </div>
            </>
          ) : (
            <div className="language-tools-group">
              <CustomLanguageSelector />
            </div>
          )}
        </div>

        {/* --- Mobile Controls --- */}
        <div className="mobile-controls">
          {user && (
            <button
              type="button"
              className="wallet-pill mobile-wallet-pill"
              onClick={() => navigate('/wallet')}
              aria-label="Open Wallet"
            >
              <IconWallet size={16} />
              {/* UPDATED: Uses formatPrice now */}
              <span className="wallet-text">{renderBalance()}</span>
            </button>
          )}
          {(
            <Link
              to="/chat"
              className="mobile-chat-pill"
              onClick={handleAuthRedirect}
            >
              <IconMessageCircle size={16} className="chat-pill-icon" />
              <span>Chat</span>
            </Link>

          )}

          <button className="hamburger-menu" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M4 6H20M4 12H20M4 18H20" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {isMenuOpen && (
          <>
            <div className="mobile-menu-backdrop" onClick={closeAllMenus}></div>
            <div className="mobile-menu" ref={mobileMenuRef}>
              {user && (
                <Link to="/profiles" className="mobile-link mobile-profile" onClick={closeAllMenus}>
                  <span className="profile-avatar">
                    {userAvatarUrl ? (
                      <img src={userAvatarUrl} alt={userName} className="profile-avatar-image" />
                    ) : (
                      <span className="profile-avatar-icon"><IconUser size={20} /></span>
                    )}
                  </span>
                  <span className="user-texts">
                    <span className="user-name">{userName}</span>
                    <span className="user-status">{getStatusText()}</span>
                  </span>
                </Link>
              )}
              <Link to="/" className="mobile-link" onClick={closeAllMenus}>Home</Link>
              {/* ... (Keep existing mobile menu links) ... */}
              <Link to="/reports#ai" className="mobile-link" onClick={handleAuthRedirect}>Reports</Link>
              <Link to="/reports#tables" className="mobile-link" onClick={handleAuthRedirect}>Birth Chart</Link>
              <Link to="/chat" className="mobile-link" onClick={handleAuthRedirect}>Chat</Link>
              <Link to="/chat?startCall=1" className="mobile-link" onClick={handleAuthRedirect}>Call</Link>
              <Link to="/remedies" className="mobile-link" onClick={handleAuthRedirect}>Remedies</Link>
              <Link to="/rashifal" className="mobile-link" onClick={closeAllMenus}>Rashifal</Link>
              <Link to="/tarot" className="mobile-link" onClick={closeAllMenus}>Tarot</Link>
              <Link to="/kundli-matching" className="mobile-link" onClick={closeAllMenus}>Kundli Matching</Link>
              <Link to="/panchang" className="mobile-link" onClick={closeAllMenus}>Panchang</Link>
              <Link to="/doshas" className="mobile-link" onClick={closeAllMenus}>Doshas</Link>
              <Link to="/numerology" className="mobile-link" onClick={closeAllMenus}>Numerology</Link>
              <Link to="/gemstones" className="mobile-link" onClick={closeAllMenus}>Gemstones</Link>
              {/* {user && (<Link to="/chat?startCall=1" className="mobile-link" onClick={closeAllMenus}>Call</Link>)} */}
              <hr className="mobile-menu-divider" />
              <div className="mobile-language-selector"><CustomLanguageSelector /></div>
              {user ? (
                <button onClick={() => { signOut(); closeAllMenus(); }} className="mobile-link-action">Sign Out</button>
              ) : null}
            </div>
          </>
        )}
      </nav>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onGoogleSignIn={signInWithFirebaseGoogle}
        phoneAuth={phoneAuthHandlers}
        firebasePhoneAuth={firebasePhoneAuthHandlers}
        msg91Auth={msg91AuthHandlers}
      />
    </>
  );
}

export default Navbar;