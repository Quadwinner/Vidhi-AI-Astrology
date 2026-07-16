import { track } from "@amplitude/analytics-browser";
import React, { useState } from "react";
import { Link } from "react-router-dom";
import AuthModal from "./AuthModal";

interface PhoneAuthHandlers {
  requestOtp: (payload: { phone: string; firstName?: string; lastName?: string; email?: string }) => Promise<void>;
  verifyOtp: (payload: { phone: string; otp: string; firstName?: string; lastName?: string; email?: string }) => Promise<void>;
}

interface Msg91AuthHandlers {
  verifyOtp: (payload: { accessToken: string; phone: string; firstName?: string; lastName?: string; email?: string }) => Promise<void>;
}

interface HeroSectionProps {
  user: any;
  onGoogleSignIn: () => void;
  phoneAuth?: PhoneAuthHandlers;
  msg91Auth?: Msg91AuthHandlers;
}

// Zodiac glyphs, Aries → Pisces
const ZODIAC = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"];

const stats = [
  { num: "1M+", label: "Birth charts analyzed" },
  { num: "100+", label: "Astrologers' logic" },
  { num: "10K+", label: "Classical texts" },
];

const trustChips = [
  { icon: "auto_awesome", text: "Free birth chart" },
  { icon: "schedule", text: "24/7 guidance" },
  { icon: "spa", text: "1 free prediction" },
];

const ZodiacWheel: React.FC = () => (
  <div className="aura-wheel-wrap aura-floating">
    <div className="aura-glow" style={{ inset: "-6%", width: "auto", height: "auto", background: "rgba(229,180,91,0.22)" }} />
    <div className="aura-wheel">
      <div className="aura-wheel-ring spin">
        {ZODIAC.map((glyph, i) => {
          const angle = -90 + i * 30;
          const rad = (angle * Math.PI) / 180;
          const r = 46; // % radius
          const left = 50 + r * Math.cos(rad);
          const top = 50 + r * Math.sin(rad);
          return (
            <span
              key={glyph}
              className="aura-sign"
              style={{ left: `${left}%`, top: `${top}%`, transform: "translate(-50%, -50%)", transformOrigin: "center" }}
            >
              {glyph}
            </span>
          );
        })}
      </div>
      <div className="aura-wheel-ring r2 spin-rev" />
      <div className="aura-wheel-ring r3 spin" />
      <div className="aura-orbit"><i /></div>
      <div className="aura-orbit o2"><i /></div>
      <div className="aura-wheel-core">
        <span className="material-symbols-outlined">nights_stay</span>
        <small>Vidhi</small>
      </div>
    </div>
  </div>
);

const HeroSection: React.FC<HeroSectionProps> = ({ user, onGoogleSignIn, phoneAuth, msg91Auth }) => {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  return (
    <section className="aura-hero">
      <div className="aura-stars-layer" />
      <div className="aura-glow" style={{ top: "4%", left: "8%", width: 360, height: 360, background: "rgba(97,7,43,0.5)" }} />
      <div className="aura-glow" style={{ bottom: "0%", right: "6%", width: 340, height: 340, background: "rgba(229,180,91,0.16)" }} />

      <div className="aura-container">
        <div className="aura-hero-grid">
          {/* Left: copy + CTA */}
          <div>
            <span className="aura-eyebrow">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1", fontSize: 16 }}>auto_awesome</span>
              Ancient wisdom · guided by AI
            </span>

            <h1 className="aura-hero-title">
              Illuminate your <span className="aura-gold-text aura-italic">cosmic path</span> with Vedic astrology
            </h1>

            <p className="aura-hero-sub">
              Your personal AI astrologer — available 24/7 for soul guidance, Kundli readings,
              and live voice calls. Rooted in a million birth charts and timeless scripture.
            </p>

            {user ? (
              <div style={{ marginTop: 32 }}>
                <Link
                  to="/chat"
                  className="aura-btn aura-btn-gold"
                  onClick={() => track("Start Chat Clicked (Hero Section)", { source: "Hero Section" })}
                >
                  <span className="material-symbols-outlined">self_improvement</span>
                  Begin your reading
                </Link>
              </div>
            ) : (
              <div style={{ marginTop: 32, display: "flex", flexWrap: "wrap", gap: 12 }}>
                <button
                  className="aura-btn aura-btn-gold"
                  onClick={() => {
                    track("Start Chatting Clicked (Hero Section)", { source: "Hero Section" });
                    setIsAuthModalOpen(true);
                  }}
                >
                  Get my free reading
                  <span className="material-symbols-outlined">arrow_forward</span>
                </button>
                <a href="#features" className="aura-btn aura-btn-outline">Explore features</a>
              </div>
            )}

            <div className="aura-hero-stats">
              {stats.map((s) => (
                <div key={s.label}>
                  <div className="aura-stat-num">{s.num}</div>
                  <div className="aura-stat-label">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: rotating zodiac wheel */}
          <div>
            <ZodiacWheel />
            <div className="aura-trust-chips">
              {trustChips.map((c) => (
                <span key={c.text} className="aura-trust-chip">
                  <span className="material-symbols-outlined">{c.icon}</span>
                  {c.text}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onGoogleSignIn={onGoogleSignIn}
        phoneAuth={phoneAuth}
        msg91Auth={msg91Auth}
      />
    </section>
  );
};

export default HeroSection;
