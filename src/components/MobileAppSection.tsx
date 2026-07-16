import React from 'react';

export default function MobileAppSection() {
  return (
    <section className="aura-section aura-appcta">
      <div className="aura-glow" style={{ bottom: -60, left: "40%", width: 340, height: 340, background: "rgba(229,180,91,0.18)" }} />
      <div className="aura-container">
        <div className="aura-appcta-grid">
          <div>
            <span className="aura-eyebrow">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>smartphone</span>
              Mobile experience
            </span>
            <h2 className="aura-h2">Your stars, always with you</h2>
            <p className="aura-lead" style={{ marginBottom: 28 }}>
              Get the Vidhi app for the full experience — real-time transit notifications,
              interactive planetary charts, and instant readings wherever you are.
            </p>
            <div className="aura-store-row">
              <button className="aura-store-btn" disabled style={{ opacity: 0.85, cursor: "default" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                </svg>
                <span>
                  <small>Download on the</small>
                  <strong>App Store</strong>
                </span>
              </button>

              <a
                href="https://play.google.com/store/apps/details?id=com.astroaura.auraai"
                target="_blank"
                rel="noopener noreferrer"
                className="aura-store-btn"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.198l2.807 1.626a1 1 0 0 1 0 1.73l-2.808 1.626L15.206 12l2.492-2.491zM5.864 2.658L16.802 8.99l-2.303 2.303-8.635-8.635z" />
                </svg>
                <span>
                  <small>Get it on</small>
                  <strong>Google Play</strong>
                </span>
              </a>
            </div>
          </div>

          <div style={{ position: "relative", display: "flex", justifyContent: "center" }}>
            <div className="aura-glow" style={{ inset: -40, width: "auto", height: "auto", background: "rgba(229,180,91,0.2)" }} />
            <div className="aura-phone aura-floating">
              <div style={{ padding: "48px 18px 18px", display: "flex", flexDirection: "column", gap: 14, height: "100%" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 999, background: "rgba(229,180,91,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--aura-gold)", fontFamily: "var(--aura-serif)", fontWeight: 700 }}>A</div>
                  <div style={{ fontFamily: "var(--aura-serif)", fontWeight: 700, color: "var(--aura-gold)" }}>Vidhi</div>
                </div>
                <div className="aura-glass" style={{ padding: 14, borderRadius: 16 }}>
                  <div style={{ fontSize: 11, color: "var(--aura-text-dim)", marginBottom: 6 }}>Today's insight</div>
                  <div style={{ fontSize: 13, lineHeight: 1.5 }}>The Moon favors clear conversations — speak your truth gently.</div>
                </div>
                <div className="aura-glass" style={{ padding: 14, borderRadius: 16, flex: 1 }}>
                  <div style={{ fontSize: 11, color: "var(--aura-text-dim)", marginBottom: 8 }}>Ask Vidhi</div>
                  <div style={{ display: "grid", gap: 8 }}>
                    <div style={{ height: 10, borderRadius: 6, background: "rgba(229,180,91,0.18)", width: "80%" }} />
                    <div style={{ height: 10, borderRadius: 6, background: "rgba(229,180,91,0.12)", width: "60%" }} />
                    <div style={{ height: 10, borderRadius: 6, background: "rgba(229,180,91,0.12)", width: "70%" }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
