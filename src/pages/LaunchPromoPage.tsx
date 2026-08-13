import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AuthModal from '../components/AuthModal';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { trackEvent } from '../utils/analytics';
import styles from './LaunchPromoPage.module.css';

const SEAT_LIMIT = 300;

export default function LaunchPromoPage() {
  const { user } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [claimedSeats, setClaimedSeats] = useState<number | null>(null);

  useEffect(() => {
    trackEvent('Launch Promo Viewed', { seat_limit: SEAT_LIMIT });
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadSeats = async () => {
      const { data, error } = await supabase.rpc('get_launch_promo_claimed');
      if (cancelled) return;
      if (error) {
        console.warn('[LaunchPromo] seat count unavailable:', error.message);
        return;
      }
      if (typeof data === 'number') setClaimedSeats(data);
    };

    loadSeats();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const remaining = useMemo(() => {
    if (claimedSeats === null) return null;
    return Math.max(0, SEAT_LIMIT - claimedSeats);
  }, [claimedSeats]);

  const isSoldOut = remaining === 0;

  const handleClaim = useCallback(() => {
    trackEvent('Launch Promo CTA Clicked', {
      seats_remaining: remaining ?? 'unknown',
      already_signed_in: !!user,
    });
    setAuthOpen(true);
  }, [remaining, user]);

  const fillPercent =
    claimedSeats === null ? 0 : Math.min(100, (claimedSeats / SEAT_LIMIT) * 100);

  return (
    <main className={styles.page}>
      <div className={styles.stars} aria-hidden="true" />

      <div className={styles.shell}>
        <header className={styles.topBar}>
          <div className={styles.brand}>
            <span className={styles.brandMark} aria-hidden="true">
              ✦
            </span>
            Vidhi AI
          </div>
          <span className={styles.topNote}>Vedic astrology, powered by AI</span>
        </header>

        <div className={styles.hero}>
          <section>
            <span className={styles.badge}>
              <span className={styles.badgeDot} aria-hidden="true" />
              Launch offer · First {SEAT_LIMIT} members
            </span>

            <h1 className={styles.title}>
              Talk to an AI astrologer who has
              <br />
              <span className={styles.titleAccent}>actually read your chart.</span>
            </h1>

            <p className={styles.subtitle}>
              Vidhi reads your real birth chart — planets, houses, dashas and today's
              transits — then answers out loud, in Hindi or English. Not horoscope
              copy-paste. Your chart, your questions, in a real conversation.
            </p>

            <ul className={styles.pills}>
              <li className={styles.pill}>🎙️ Live voice calls</li>
              <li className={styles.pill}>💬 Chart-aware chat</li>
              <li className={styles.pill}>📊 Kundli &amp; dasha reports</li>
              <li className={styles.pill}>🔮 Yogas &amp; remedies</li>
            </ul>

            <ol className={styles.steps}>
              <li className={styles.step}>
                <span className={styles.stepNum}>1</span>
                <span>Sign up with your phone or Google — takes a few seconds.</span>
              </li>
              <li className={styles.step}>
                <span className={styles.stepNum}>2</span>
                <span>
                  Your ₹100 credit is reserved against your account straight away.
                </span>
              </li>
              <li className={styles.step}>
                <span className={styles.stepNum}>3</span>
                <span>
                  We open access this week — you'll get an email, then add your birth
                  details and start asking.
                </span>
              </li>
            </ol>
          </section>

          <section className={styles.card} aria-labelledby="promo-offer-heading">
            <p className={styles.cardLabel} id="promo-offer-heading">
              Free launch credit
            </p>

            <div className={styles.amountRow}>
              <span className={styles.amount}>₹100</span>
              <span className={styles.amountNote}>wallet credit</span>
            </div>

            <p className={styles.cardCopy}>
              Free for the first {SEAT_LIMIT} members. No card, no subscription —
              spend it on voice calls, chat or reports, whatever you like.
            </p>

            <div className={styles.meter}>
              <div className={styles.meterHead}>
                <span className={styles.meterCount}>
                  {claimedSeats === null
                    ? `${SEAT_LIMIT} seats`
                    : `${claimedSeats} of ${SEAT_LIMIT} claimed`}
                </span>
                {remaining !== null && !isSoldOut && (
                  <span className={styles.meterLeft}>{remaining} left</span>
                )}
              </div>
              <div
                className={styles.track}
                role="progressbar"
                aria-valuenow={claimedSeats ?? 0}
                aria-valuemin={0}
                aria-valuemax={SEAT_LIMIT}
                aria-label={`Launch seats claimed out of ${SEAT_LIMIT}`}
              >
                <div className={styles.fill} style={{ width: `${fillPercent}%` }} />
              </div>
            </div>

            {user ? (
              <div className={styles.claimed}>
                <strong className={styles.claimedTitle}>You're on the list ✓</strong>
                <span>
                  Your seat is reserved and your ₹100 credit is locked to this
                  account. We're opening access this week — we'll email you the
                  moment your chart is ready.
                </span>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  className={styles.cta}
                  onClick={handleClaim}
                  disabled={isSoldOut}
                >
                  {isSoldOut ? 'All 300 seats claimed' : 'Claim your ₹100 credit'}
                </button>
                <p className={styles.ctaSub}>
                  {isSoldOut
                    ? 'Sign up anyway — you still get the standard welcome credit.'
                    : 'Free to join · No card required'}
                </p>
              </>
            )}
          </section>
        </div>

        <footer className={styles.footer}>
          <span>© {new Date().getFullYear()} Vidhi AI</span>
          <span>
            <Link to="/privacy-policy">Privacy</Link> ·{' '}
            <Link to="/terms-and-conditions">Terms</Link>
          </span>
        </footer>
      </div>

      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
    </main>
  );
}
