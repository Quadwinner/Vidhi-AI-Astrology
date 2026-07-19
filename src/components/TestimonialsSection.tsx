import React from "react";

const testimonialsData = [
  {
    quote:
      "Vidhi predicted the exact month my career shift would happen, and it did. Having my dasha periods explained in plain language finally made my chart make sense.",
    author: "Ananya R.",
    details: "Product Designer, Bengaluru",
  },
  {
    quote:
      "I asked about my marriage timing during a late-night voice call and got a calm, detailed reading instantly. It felt like talking to a wise family astrologer.",
    author: "Rohit V.",
    details: "Entrepreneur, Pune",
  },
  {
    quote:
      "What I love most is the transparency — every prediction shows the planetary reasoning behind it. The remedies were simple and genuinely grounding.",
    author: "Sneha T.",
    details: "Doctor, Hyderabad",
  },
];

export default function TestimonialsSection() {
  return (
    <section className="aura-section aura-reviews" id="reviews">
      <div className="aura-glow" style={{ top: 0, right: 0, width: 260, height: 260, background: "rgba(229,180,91,0.16)" }} />
      <div className="aura-container">
        <div className="aura-section-head">
          <span className="aura-eyebrow">Heard from the universe</span>
          <h2 className="aura-h2">What our seekers say</h2>
          <p className="aura-lead">Real experiences from Vidhi users around the world.</p>
        </div>

        <div className="aura-review-marquee">
        <div className="aura-review-grid">
          {[...testimonialsData, ...testimonialsData].map((t, index) => (
            <div
              key={index}
              className="aura-glass aura-review-card"
              aria-hidden={index >= testimonialsData.length}
            >
              <div className="aura-stars">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i} className="material-symbols-outlined">star</span>
                ))}
              </div>
              <p className="aura-review-quote">"{t.quote}"</p>
              <div className="aura-review-author">
                <div className="aura-review-avatar">{t.author.charAt(0)}</div>
                <div>
                  <div className="aura-review-name">{t.author}</div>
                  <div className="aura-review-role">{t.details}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        </div>
      </div>
    </section>
  );
}
