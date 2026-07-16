import { motion } from "framer-motion";
import React from "react";

const testimonialsData = [
  {
    quote:
      "The accuracy of the AI voice call left me speechless. It picked up on subtle transit influences I hadn't even noticed myself.",
    author: "Priya M.",
    details: "Marketing Professional",
  },
  {
    quote:
      "I've tried a lot of astrology apps, but this one feels different. The reading felt personal and I could see exactly why the prediction was made.",
    author: "Arun S.",
    details: "Software Engineer",
  },
  {
    quote:
      "My go-to app for clarity. The Kundli analysis is more thorough than many human consultations I've had.",
    author: "Meera K.",
    details: "Yoga Instructor",
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

        <div className="aura-review-grid">
          {testimonialsData.map((t, index) => (
            <motion.div
              key={index}
              className="aura-glass aura-review-card"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
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
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
