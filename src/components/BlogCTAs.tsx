// MODIFIED: Import useState and useMemo
import React, { useState, useMemo } from 'react';
// 1. Import the necessary hooks
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { FaComments, FaChartBar, FaPhoneAlt } from 'react-icons/fa';
import './BlogCTAs.css';
// NEW: Import the AuthModal component
import AuthModal from './AuthModal';

const BlogCTAs = () => {
  // NEW: Add state for modal visibility
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // 2. MODIFIED: Get all necessary auth functions from the context
  const {
    user,
    signInWithFirebaseGoogle,
    requestPhoneOtp,
    verifyPhoneOtp,
    requestFirebasePhoneOtp,
    verifyFirebasePhoneOtp,
    verifyMsg91Otp,
  } = useAuth();
  const navigate = useNavigate();

  // NEW: Memoize phone auth handlers, just like in the other components
  const phoneAuthHandlers = useMemo(
    () => ({
      requestOtp: requestPhoneOtp,
      verifyOtp: verifyPhoneOtp,
    }),
    [requestPhoneOtp, verifyPhoneOtp]
  );

  const firebasePhoneAuthHandlers = useMemo(
    () => ({
      requestOtp: requestFirebasePhoneOtp,
      verifyOtp: verifyFirebasePhoneOtp,
    }),
    [requestFirebasePhoneOtp, verifyFirebasePhoneOtp]
  );

  const msg91AuthHandlers = useMemo(
    () => ({
      verifyOtp: verifyMsg91Otp,
    }),
    [verifyMsg91Otp]
  );

  // 3. MODIFIED: Update the handler to open the modal
  const handleProtectedLinkClick = (path: string) => {
    if (user) {
      // If the user is logged in, navigate as before
      navigate(path);
    } else {
      // If the user is not logged in, open the new modal
      setIsAuthModalOpen(true);
    }
  };

  return (
    // WRAPPED: Use a React Fragment to return multiple elements
    <>
      <div className="blog-ctas-container">
        {/* Card 1: Chat */}
        <div className="cta-card">
          <div className="cta-icon-wrapper chat-icon">
            <FaComments size={28} />
          </div>
          <h3 className="cta-title">AI Chat</h3>
          <p className="cta-text">
            Get instant answers and personalized astrological guidance by chatting with Vidhi AI.
          </p>
          {/* 4. This button now correctly opens the modal for logged-out users */}
          <button
            onClick={() => handleProtectedLinkClick('/chat')}
            className="cta-button chat-btn"
          >
            Start AI Chat
          </button>
        </div>

        {/* Card 2: Reports */}
        <div className="cta-card">
          <div className="cta-icon-wrapper reports-icon">
            <FaChartBar size={28} />
          </div>
          <h3 className="cta-title">AI Reports</h3>
          <p className="cta-text">
            Unlock deep insights into your life path with detailed, personalized AI-generated reports.
          </p>
          <button
            onClick={() => handleProtectedLinkClick('/reports')}
            className="cta-button reports-btn"
          >
            Get Your Report
          </button>
        </div>
        
        {/* Card 3: Call */}
        <div className="cta-card">
          <div className="cta-icon-wrapper call-icon">
            <FaPhoneAlt size={28} />
          </div>
          <h3 className="cta-title">AI Voice Call</h3>
          <p className="cta-text">
            Experience a one-on-one voice conversation with Vidhi AI for in-depth guidance.
          </p>
          <button
            onClick={() => handleProtectedLinkClick('/chat?startCall=1')}
            className="cta-button call-btn"
          >
            Start AI Call
          </button>
        </div>
      </div>

      {/* NEW: Render the AuthModal and pass all the necessary props */}
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
};

export default BlogCTAs;