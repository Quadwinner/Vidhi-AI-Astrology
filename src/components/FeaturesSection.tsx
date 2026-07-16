import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import AuthModal from "./AuthModal";

type Card = {
  icon: string;
  title: string;
  desc: string;
  cta: string;
  path: string;
  span: "c2" | "c3";
};

// Bento layout: featured (span 4) + voice (2) → three span-2 → two span-3
const cards: Card[] = [
  { icon: "call", title: "Live Voice Calls", desc: "Connect instantly for real-time spoken guidance from a lifelike AI astrologer.", cta: "Call now", path: "/chat?startCall=1", span: "c2" },
  { icon: "auto_graph", title: "Personalized Kundli", desc: "Deep-dive into your birth chart with precise planetary positions and house analysis.", cta: "Generate chart", path: "/reports", span: "c2" },
  { icon: "sunny", title: "Daily Insights", desc: "Personalized horoscopes based on your unique transits — not just your sun sign.", cta: "Read today's", path: "/chat", span: "c2" },
  { icon: "favorite", title: "Love & Relationships", desc: "Kundli matching (Gun Milan) and synastry for harmonious connections.", cta: "Check match", path: "/chat", span: "c2" },
  { icon: "account_balance", title: "Career & Finance", desc: "Align your professional life with your planetary strengths and time your ventures.", cta: "View forecast", path: "/chat", span: "c3" },
  { icon: "spa", title: "Health & Vitality", desc: "Ayurvedic connections to your placements for holistic physical and mental well-being.", cta: "Soul wellness", path: "/chat", span: "c3" },
];

const questions = [
  "Ask about your Saturn transit or career path…",
  "Am I compatible with my partner?",
  "When is the best window for a new venture?",
  "What does my Rahu Mahadasha suggest?",
  "How can I strengthen my spiritual practice?",
];

const AskPill: React.FC<{ onAsk: (q: string) => void }> = ({ onAsk }) => {
  const [idx, setIdx] = useState(0);
  const [text, setText] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const full = questions[idx];
    const t = setTimeout(() => {
      setText((prev) => (deleting ? full.substring(0, prev.length - 1) : full.substring(0, prev.length + 1)));
      if (!deleting && text === full) setTimeout(() => setDeleting(true), 2200);
      else if (deleting && text === "") {
        setDeleting(false);
        setIdx((p) => (p + 1) % questions.length);
      }
    }, deleting ? 40 : 85);
    return () => clearTimeout(t);
  }, [text, deleting, idx]);

  return (
    <div className="aura-ask-pill" onClick={() => onAsk(questions[idx])}>
      <span className="material-symbols-outlined">auto_awesome</span>
      <span className="aura-ask-text">{text}</span>
      <button className="aura-btn aura-btn-gold" style={{ padding: "10px 20px" }}>Ask Vidhi</button>
    </div>
  );
};

export default function FeaturesSection() {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
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

  const phoneAuthHandlers = useMemo(
    () => ({ requestOtp: requestPhoneOtp, verifyOtp: verifyPhoneOtp }),
    [requestPhoneOtp, verifyPhoneOtp]
  );
  const firebasePhoneAuthHandlers = useMemo(
    () => ({ requestOtp: requestFirebasePhoneOtp, verifyOtp: verifyFirebasePhoneOtp }),
    [requestFirebasePhoneOtp, verifyFirebasePhoneOtp]
  );
  const msg91AuthHandlers = useMemo(() => ({ verifyOtp: verifyMsg91Otp }), [verifyMsg91Otp]);

  const go = (path: string) => {
    if (user) navigate(path);
    else setIsAuthModalOpen(true);
  };

  const ask = (q: string) => {
    if (user) navigate(`/chat?prompt=${encodeURIComponent(q)}`);
    else setIsAuthModalOpen(true);
  };

  return (
    <>
      <section className="aura-section" id="features">
        <div className="aura-glow" style={{ top: "10%", left: "50%", transform: "translateX(-50%)", width: 520, height: 400, background: "rgba(97,7,43,0.28)" }} />
        <div className="aura-container">
          <div className="aura-section-head">
            <span className="aura-eyebrow">Celestial features</span>
            <h2 className="aura-h2">What can Vidhi reveal for you?</h2>
            <p className="aura-lead">
              Unlock ancient Vedic wisdom through advanced AI — from planetary alignments to
              daily cosmic rhythms, discover the map of your soul.
            </p>
            <AskPill onAsk={ask} />
          </div>

          <div className="aura-bento">
            {/* Featured: AI Astrology Chat */}
            <button className="aura-feat aura-feat-featured aura-feat-c4" onClick={() => go("/chat")}>
              <div className="aura-feat-body">
                <div className="aura-feat-badge"><span className="material-symbols-outlined">psychology</span></div>
                <h4>AI Astrology Chat</h4>
                <p>
                  A sanctuary of wisdom. Vidhi draws on classical Sanskrit texts to give nuanced,
                  conversational answers to your deepest life questions.
                </p>
                <span className="aura-explore" style={{ marginTop: 16 }}>
                  Explore the sanctuary <span className="material-symbols-outlined">arrow_forward</span>
                </span>
              </div>
              <div className="aura-chatmock" onClick={(e) => e.stopPropagation()}>
                <div className="aura-bubble aura-bubble-user">What does my Rahu Mahadasha suggest?</div>
                <div className="aura-bubble aura-bubble-ai">
                  <b>Vidhi analysis</b>
                  Your Rahu transit in the 10th house signals a transformative shift in status — a
                  period for calculated risks and bold new beginnings.
                </div>
              </div>
            </button>

            {/* Remaining cards */}
            {cards.map((c) => (
              <button key={c.title} className={`aura-feat aura-feat-${c.span}`} onClick={() => go(c.path)}>
                <div>
                  <div className="aura-feat-badge"><span className="material-symbols-outlined">{c.icon}</span></div>
                  <h4>{c.title}</h4>
                  <p>{c.desc}</p>
                </div>
                <span className="aura-explore">
                  {c.cta} <span className="material-symbols-outlined">arrow_forward</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

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
