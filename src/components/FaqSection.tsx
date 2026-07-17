import React from 'react';

const faqData = [
  {
    question: "What is Vidhi?",
    answer:
      "Vidhi is your personal Vedic astrology companion. From your exact birth details it builds your full Kundli and then lets you explore it through AI chat, live voice calls, in-depth reports, personalised remedies, and daily Rashifal — all grounded in classical Vedic principles, not generic sun-sign horoscopes.",
  },
  {
    question: "How does Vidhi generate my predictions?",
    answer:
      "Vidhi calculates your birth chart, divisional charts, Vimshottari Dasha timeline, planetary aspects, and yogas, then reasons over them the way a traditional astrologer would. Every answer is tied to the actual placements in your chart, so guidance stays consistent and personal to you.",
  },
  {
    question: "What can I ask in chat and voice calls?",
    answer:
      "Anything on your mind — career and finances, marriage and relationships, health, education, timing of important decisions, or the meaning of a specific planet or dasha period. Voice calls give you a natural, real-time spoken conversation with your AI astrologer.",
  },
  {
    question: "What are reports and remedies?",
    answer:
      "Reports are detailed written analyses — like your Destiny Blueprint, Career Mastery, or Love & Marriage — covering a life area in depth. Remedies suggest simple, practical steps (gemstones, mantras, charity, lifestyle) tailored to the strengths and challenges in your chart.",
  },
  {
    question: "How does pricing and the wallet work?",
    answer:
      "Vidhi runs on a simple coin wallet. New users get welcome coins to explore, and you recharge whenever you like. Chats, voice-call minutes, reports, and remedies each have a clear rate shown before you spend, so there are no surprises.",
  },
  {
    question: "Which languages does Vidhi support?",
    answer:
      "Vidhi replies in the language you use. Ask in English and you get English; ask in Hindi and you get Hindi — including natural Hindi voice calls — so your guidance always feels familiar.",
  },
  {
    question: "How is my data kept private?",
    answer:
      "Your birth details and conversations are encrypted in transit and stored securely. We never sell your personal information, and your chart data is used only to generate your own readings.",
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
