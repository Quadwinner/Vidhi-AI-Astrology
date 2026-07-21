// src/pages/PlanetaryTransitsPage.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import './BlogPostPage.css';

import TrendingUp from '../assets/TrendingUp.png';
import Yellowstar from '../assets/yellowstar.png';
import people from '../assets/people.png';
import transist from '../assets/Transist.png';
import linearrow from '../assets/linearrow.svg';
import forecast from '../assets/Forecast.png';
import report from '../assets/Report.png';
import anylysis from '../assets/anaylsis.png';
import consultant from '../assets/consultant.png';
import BlogBackground from '../assets/img5.png';
import BlogProfile from '../assets/BlogProfile.svg';
import Bluechat from '../assets/Bluechat.png';

const PlanetaryTransitsBlog: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="astro-aura-container">
      {/* Header */}
      <Navbar />

      <main className="blog-main">
        <a href="#" className="back-to-blog" onClick={() => navigate("/blog")}>
          Back to Blog
        </a>

        {/* Blog Post Header */}
        <section className="blog-header">
          <div className="blog-meta">
            <span>Planetary</span>
            <span className="dot">•</span>
            <span className="small-title">December 8, 2024</span>
            <span className="dot">•</span>
            <span className="small-title">8 min read</span>
            <span className="dot">•</span>
            <span className="small-title">By Dr. Michael Rao</span>
          </div>
          <h1 className="blog-title">Understanding Planetary Transits and Their Life Impact</h1>
          <p className="subtitle">
            Planetary transits are powerful astrological events that influence your daily life, relationships, and major decisions. Learn how to harness cosmic timing for growth and transformation.
          </p>
          <img src={BlogBackground} alt="alt" className="BlogBackground" />
          <p className="below-subtitle">
            As planets move across the zodiac, they activate specific areas of your birth chart. This creates opportunities for change, challenges to overcome, and moments of clarity that guide you forward.
          </p>
        </section>

        {/* Main Content */}
        <div className="blog-content">
          <h2 className="mercury-title">What Are Planetary Transits?</h2>
          <p>
            A planetary transit occurs when a planet moves through a zodiac sign or interacts with your natal planets. These movements reflect cycles of growth, transformation, and lessons in different areas of life.
          </p>
          <p>
            For example, Jupiter’s transits often bring expansion, abundance, and new opportunities, while Saturn’s influence may bring responsibility, structure, and important life lessons.
          </p>

          <h2 className="mercury-title">How Transits Affect Your Life</h2>
          <ul className="retrograde-dates">
            <li>
              <strong>Career:</strong>
              <span> Transits highlight times for promotions, job changes, or building discipline in your professional path.</span>
            </li>
            <li>
              <strong>Relationships:</strong>
              <span> Venus and Mars transits can bring passion, challenges, or opportunities for deep connection.</span>
            </li>
            <li>
              <strong>Personal Growth:</strong>
              <span> Uranus, Neptune, and Pluto guide transformation, awakening, and spiritual evolution.</span>
            </li>
          </ul>

          <h2 className="shadow">Why Timing Matters</h2>
          <p>
            Understanding transits helps you align actions with cosmic rhythms. Instead of resisting change, you can use astrology as a tool to plan wisely, embrace challenges, and maximize growth opportunities.
          </p>
        </div>

        {/* Personal Report CTA */}
        <section className="cta-card personal-report-cta">
          <div>
            <h3>Get Your Personalized Transit Report</h3>
            <p>See how upcoming planetary movements will impact your sign and chart.</p>
            <button className="cta-btn gradient-btn" onClick={() => navigate("/reports")}>Generate My Report</button>
          </div>
          <img src={TrendingUp} className="cta-icon" />
        </section>

        {/* Effects on Zodiac */}
        <section className="zodiac-effects">
          <h2 className="mercury-titles">Transit Effects by Element</h2>
          <div className="zodiac-grid">
            <div className="zodiac-card">
              <h4 className="fire">Fire Signs</h4>
              <p>Aries, Leo, Sagittarius feel bold shifts in energy, pushing them to take risks and pursue passions.</p>
            </div>
            <div className="zodiac-card">
              <h4 className="earth">Earth Signs</h4>
              <p>Taurus, Virgo, Capricorn experience grounding changes that focus on stability and structure.</p>
            </div>
            <div className="zodiac-card">
              <h4 className="air">Air Signs</h4>
              <p>Gemini, Libra, Aquarius find inspiration in communication, ideas, and social connections.</p>
            </div>
            <div className="zodiac-card">
              <h4 className="water">Water Signs</h4>
              <p>Cancer, Scorpio, Pisces undergo emotional and spiritual growth, deepening intuitive awareness.</p>
            </div>
             <div className="zodiac-card">
              <h4 className="air">Air Signs</h4>
              <p>Gemini, Libra, Aquarius find inspiration in communication, ideas, and social connections.</p>
            </div>
            <div className="zodiac-card">
              <h4 className="water">Water Signs</h4>
              <p>Cancer, Scorpio, Pisces undergo emotional and spiritual growth, deepening intuitive awareness.</p>
            </div>
          </div>
        </section>

        {/* Author Bio */}
        <section className="author-bio">
          <img src={BlogProfile} alt="Dr. Michael Rao" className="blogProfile" />
          <div className="author-details">
            <h3>Dr. Michael Rao</h3>
            <p className="author-title">Astrologer & Transit Specialist</p>
            <div className="author-stats">
              <span><img src={Yellowstar} className="star" />4.8 Rating</span>
              <span className="exp"><img src={people} /> 12+ Years Experience</span>
            </div>
            <p className="author-description">
              Dr. Michael Rao specializes in planetary transits and their influence on everyday life. His guidance helps people align with cosmic timing to create success and clarity.
            </p>
          </div>
        </section>

        {/* Chat with AI */}
        <section className="cta-card chat-ai-cta">
          <img src={Bluechat} alt="alt" />
          <div className="chat-content">
            <h3>Chat with Vidhi AI About Planetary Transits</h3>
            <p>Discover how current transits affect your zodiac sign, career, and relationships.</p>
            <button className="cta-btn secondary-btn" onClick={() => navigate("/chat")}>Start AI Chat Now</button>
          </div>
        </section>

        {/* You Might Also Like */}
        <section className="related-articless">
          <h2 className="like">You Might Also Like</h2>
          <div className="articless-grid">
            <div className="article-card">
              <div className="article-icon-wrapper"><img src={forecast} /></div>
              <h4>2025 Saturn Transits</h4>
              <p>Understand how Saturn’s movements will shape discipline and growth in 2025.</p>
              <span>9 min read</span>
              <a href="#"><img src={linearrow} alt="alt" /></a>
            </div>
            <div className="article-card">
              <div className="article-icon-wrapper calendar"><img src={transist} alt="alt" /></div>
              <h4>Jupiter’s Blessings in 2025</h4>
              <p>Explore how Jupiter’s influence brings abundance and optimism in the new year.</p>
              <span>7 min read</span>
              <a href="#"><img src={linearrow} alt="alt" /></a>
            </div>
            <div className="article-card">
              <div className="article-icon-wrapper aiforecast"><img src={forecast} alt="alt" /></div>
              <h4>Neptune & Spiritual Awakening</h4>
              <p>Discover how Neptune inspires dreams, intuition, and spiritual growth.</p>
              <span>8 min read</span>
              <a href="#"><img src={linearrow} alt="alt" /></a>
            </div>
          </div>
        </section>

        {/* Take Action */}
        <section className="take-action">
          <h2 className="actionBased">Take Action Based on This Article</h2>
          <p>Get clarity on how planetary transits will influence your journey.</p>
          <div className="action-grid">
            <div className="action-card">
              <div className="action-icon-wrapper"><img src={report} /></div>
              <h4>Personal Transit Report</h4>
              <p>A forecast tailored to your birth chart and upcoming transits.</p>
              <button className="cta-btn gradient-btn-alt" onClick={() => navigate("/reports")}>Generate Report</button>
            </div>
            <div className="action-card popular">
              <span className="popular-badge">Most Popular</span>
              <div className="action-icon-wrapper"><img src={anylysis} alt="alt" /></div>
              <h4>Complete Transit Analysis</h4>
              <p>Get monthly breakdowns of how planetary shifts shape your life in 2025.</p>
              <button className="cta-btn full-btn" onClick={() => navigate("/reports")}>Get Full Analysis</button>
            </div>
            <div className="action-card">
              <div className="action-icon-wrapper ai-chat"><img src={consultant} alt="alt" /></div>
              <h4>AI Transit Chat</h4>
              <p>Ask Vidhi AI how specific planetary transits affect your sign.</p>
              <button className="cta-btn tertiary-btn" onClick={() => navigate("/chat")}>Start AI Chat - Free</button>
            </div>
            <div className="action-card">
              <div className="action-icon-wrapper ai-chat"><img src={consultant} alt="alt" /></div>
              <h4>AI Transit Chat</h4>
              <p>Ask Vidhi AI how specific planetary transits affect your sign.</p>
              <button className="cta-btn tertiary-btn" onClick={() => navigate("/chat")}>Start AI Chat - Free</button>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
};

export default PlanetaryTransitsBlog;
