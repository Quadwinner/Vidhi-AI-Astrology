import React from 'react';

const faqData = [
  {
    question: "What is Vidhi?",
    answer:
      "Vidhi takes the ancient practice of Vedic astrology and gives it a modern engine. Instead of short, vague horoscopes, it offers clear, actionable guidance — what might happen, when, and how likely it is — with a simple note on the astrological principle behind each prediction.",
  },
  {
    question: "How accurate are the results?",
    answer:
      "The system has learned from millions of anonymized birth charts and thousands of classical rules, letting it spot patterns too complex for a single astrologer to track. Rather than saying \"something may happen soon,\" it shows a probability range so you can gauge confidence before deciding.",
  },
  {
    question: "Why AI astrology?",
    answer:
      "Vidhi removes the guesswork of choosing an astrologer. It combines insights from verified astrologers, millions of historical charts, and advanced AI models to deliver consistent, transparent guidance — with unlimited chats and calls under fair use.",
  },
  {
    question: "Can I get a live consultation?",
    answer:
      "Yes. Through AI Voice Calls you can have a real-time spoken interaction with Vidhi that feels natural and personal, any time of day.",
  },
  {
    question: "How is my data kept private?",
    answer:
      "Vidhi uses encryption in transit, anonymized storage of birth data, and strict privacy policies. Your personal details are never sold.",
  },
  {
    question: "When is help available?",
    answer:
      "Whenever you need it. Whether it's midnight in Mumbai or dawn in Chicago, you can get a reading without a queue or per-minute charge on chat.",
  },
];

export default function FaqSection() {
  return (
    <section className="aura-section aura-faq" id="faq">
      <div className="aura-container">
        <div className="aura-section-head">
          <span className="aura-eyebrow">Cosmic inquiries</span>
          <h2 className="aura-h2">Your questions, answered</h2>
          <p className="aura-lead">Unravel the mysteries of your astrological journey.</p>
        </div>

        <div className="aura-faq-list">
          {faqData.map((faq, index) => (
            <details key={index} className="aura-glass aura-faq-item">
              <summary>
                <span>{faq.question}</span>
                <span className="material-symbols-outlined">expand_more</span>
              </summary>
              <div className="aura-faq-answer">{faq.answer}</div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
