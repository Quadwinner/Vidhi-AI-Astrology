// src/components/CoinBalance.tsx

import React from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
// The styles for this component will be in Navbar.css to keep them bundled
// import './CoinBalance.css'; // Optional: if you prefer a separate CSS file

// A new, visually improved coin icon component
const CoinIcon = () => (
  <span className="coin-icon"></span>
);

export default function CoinBalance() {
  const { user, checkingStatus } = useAuth();
  const [questionsRemaining, setQuestionsRemaining] = React.useState<number | null>(null);
  const [talkMinutesRemaining, setTalkMinutesRemaining] = React.useState<number | null>(null);

  React.useEffect(() => {
    const fetchCounters = async () => {
      if (!user) return;
      try {
        const { data, error } = await supabase.rpc('get_current_cycle_counters', { p_user_id: user.id });
        if (!error && data && data.length > 0) {
          const row = data[0];
          setQuestionsRemaining(row.questions_remaining ?? 0);
          setTalkMinutesRemaining(row.talk_minutes_remaining ?? 0);
        }
      } catch (_) {
        // no-op
      }
    };
    fetchCounters();
  }, [user]);

  // 1. Loading State: A simple pulsing animation for the placeholder
  if (checkingStatus) {
    return (
      <div className="coin-balance-container coin-loading">
        <span>...</span>
      </div>
    );
  }

  // Display remaining questions/talk minutes for all users
  return (
    <div className="coin-balance-container">
      <CoinIcon />
      <span className="coin-text">
        {questionsRemaining ?? '—'}/{talkMinutesRemaining ?? '—'}
      </span>
    </div>
  );
}