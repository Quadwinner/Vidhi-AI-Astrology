import React from 'react';
import {
  IoIosArrowBack,
  IoIosArrowForward,
  IoMdArrowDropdown,
} from 'react-icons/io';
import { FaStar, FaGlobe } from 'react-icons/fa';
import { BsPeopleFill } from 'react-icons/bs';
import {
  FiBarChart2,
  FiMessageSquare,
  FiCalendar,
  FiFileText,
  FiCpu,
  FiTrendingUp
} from 'react-icons/fi';
import './BlogPostPage.css';
import Navbar from '../components/Navbar';
import TrendingUp  from '../assets/TrendingUp.png';
import Yellowstar from '../assets/yellowstar.png';
import people from '../assets/people.png';
import transist from '../assets/Transist.png';
import linearrow from '../assets/linearrow.svg';
import forecast from '../assets/Forecast.png';
import report from '../assets/Report.png';
import anylysis from '../assets/anaylsis.png';
import consultant from '../assets/consultant.png';
import BlogBackground from '../assets/img4.png';
import BlogProfile from '../assets/BlogProfile.svg';
import Bluechat from '../assets/Bluechat.png';
import {useNavigate } from 'react-router-dom';



const BlogPostPage: React.FC = () => {
  const navigate = useNavigate();
  
  return (
    <div className="astro-aura-container">
      {/* Header */}
     <Navbar/>

      <main className="blog-main">
        <a href="#" className="back-to-blog" onClick={() => navigate("/blog")}>
          Back to Blog
        </a>

        {/* Blog Post Header */}
        <section className="blog-header">
          <div className="blog-meta">
            <span>Featured</span>
            <span className="dot">•</span>
            <span className='small-title'>December 10, 2024</span>
            <span className="dot">•</span>
            <span className='small-title'>9 min read</span>
            <span className="dot">•</span>
            <span className='small-title'>By Dr. Sarah Chen</span>
          </div>
          <h1 className='blog-title'>2024 Year-End Predictions: What the Stars Reveal</h1>
          <p className="subtitle">
            As 2024 draws to a close, the stars align to reveal themes of transformation, growth, and renewal. Discover what the cosmos has in store for each zodiac sign and how you can prepare for 2025.
          </p>
          <img src={BlogBackground} alt="alt" className='BlogBackground' />
          <p className='below-subtitle'>
            The final months of 2024 bring powerful planetary alignments that influence love, career, finances, and personal growth. These celestial events provide opportunities for closure, reflection, and setting intentions for the new year.
          </p>
        </section>

        {/* Main Content */}
        <div className="blog-content">
          <h2 className='mercury-title'>Major Planetary Influences</h2>
          <p>
            The end of 2024 is marked by Jupiter’s expansive energy meeting Saturn’s discipline, creating a balance between ambition and practicality. This is a time when many will feel the urge to finalize long-term projects and set realistic goals for the coming year.
          </p>
          <p>
            Neptune’s influence also highlights intuition, dreams, and spiritual growth. Pay attention to insights from your inner voice — they may guide you toward unexpected opportunities in 2025.
          </p>

          <h2 className='mercury-title'>Key Predictions for Year-End</h2>
          <p>Here are some of the themes the stars reveal as 2024 comes to an end:</p>
          <ul className="retrograde-dates">
            <li>
              <strong>Career:</strong>
              <span> Many signs will experience closure in professional projects and prepare for new beginnings in 2025.</span>
            </li>
            <li>
              <strong>Relationships:</strong>
              <span> Old patterns may resurface, offering a chance to heal and build stronger connections.</span>
            </li>
            <li>
              <strong>Finances:</strong>
              <span> Practical budgeting and strategic planning will help secure stability for the year ahead.</span>
            </li>
          </ul>

          <h2 className='shadow'>Preparing for 2025</h2>
          <p>
            The final weeks of 2024 encourage self-reflection and intentional goal-setting. By acknowledging what you’ve accomplished and releasing what no longer serves you, you create space for growth, abundance, and success in the coming year.
          </p>
        </div>

        {/* Personal Report CTA */}
        <section className="cta-card personal-report-cta">
          <div>
            <h3>Get Your 2025 Personalized Forecast</h3>
            <p>Discover how the planetary shifts of 2025 will impact your zodiac sign and life path.</p>
            <button className="cta-btn gradient-btn" onClick={() => navigate("/reports")}>Generate My Forecast</button>
          </div>
          <img src={TrendingUp} className="cta-icon" />
        </section>

        {/* Effects on Zodiac */}
        <section className="zodiac-effects">
            <h2 className='mercury-titles'>Year-End Effects on Each Zodiac Sign</h2>
            <div className="zodiac-grid">
                <div className="zodiac-card">
                    <h4 className='fire'>Fire Signs</h4>
                    <p>Aries, Leo, Sagittarius are encouraged to channel energy into bold plans for 2025 while closing unfinished projects.</p>
                </div>
                <div className="zodiac-card">
                    <h4 className='earth'>Earth Signs</h4>
                    <p>Taurus, Virgo, Capricorn benefit from practical planning, securing financial stability, and laying new foundations.</p>
                </div>
                <div className="zodiac-card">
                    <h4 className='air'>Air Signs</h4>
                    <p>Gemini, Libra, Aquarius experience breakthroughs in communication, relationships, and creative ideas.</p>
                </div>
                <div className="zodiac-card">
                    <h4 className='water'>Water Signs</h4>
                    <p>Cancer, Scorpio, Pisces focus on emotional healing, spiritual growth, and deepening bonds with loved ones.</p>
                </div>
            </div>
        </section>

        {/* Author Bio */}
        <section className="author-bio">
            <img src={BlogProfile} alt="Dr. Sarah Chen" className='blogProfile' />
            <div className="author-details">
                <h3>Dr. Sarah Chen</h3>
                <p className="author-title">Astrologer & Predictive Astrology Specialist</p>
                <div className="author-stats">
                    <span><img src={Yellowstar} className='star'/>4.9 Rating</span>
                    <span className='exp'><img src={people}  /> 15+ Years Experience</span>
                </div>
                <p className="author-description">
                    Dr. Sarah Chen is renowned for her year-ahead forecasts and predictive astrology. She has guided thousands in preparing for cosmic shifts with clarity and confidence.
                </p>
            </div>
        </section>

        {/* Chat with AI */}
        <section className="cta-card chat-ai-cta">
            <img src={Bluechat} alt="alt" />
            <div className="chat-content">
                <h3>Chat with Aura AI About 2025 Predictions</h3>
                <p>Ask Aura AI how the new year will affect your sign in love, career, and personal growth.</p>
                <button className="cta-btn secondary-btn" onClick={() => navigate("/chat")}>Start AI Chat Now</button>
            </div>
        </section>

        {/* You Might Also Like */}
        <section className="related-articless">
            <h2 className="like">You Might Also Like</h2>
            <div className="articless-grid">
                <div className="article-card">
                    <div className="article-icon-wrapper"><img src={transist}/></div>
                    <h4>2025 Planetary Preview</h4>
                    <p>Ahead-of-time insights into the most important astrological events of 2025.</p>
                    <span>10 min read</span>
                    <a href="#"><img src={linearrow} alt="alt"/></a>
                </div>
                <div className="article-card">
                    <div className="article-icon-wrapper calendar"><img src={forecast} alt="alt" /></div>
                    <h4>Saturn’s Role in 2025</h4>
                    <p>Explore how Saturn’s placement shapes discipline, structure, and responsibilities in the year ahead.</p>
                    <span>8 min read</span>
                    <a href="#"><img src={linearrow} alt="alt"/></a>
                </div>
                <div className="article-card">
                    <div className="article-icon-wrapper aiforecast"><img src={forecast} alt="alt" /></div>
                    <h4>Love Predictions for 2025</h4>
                    <p>Find out how Venus and Mars influence love, romance, and relationships in the new year.</p>
                    <span>7 min read</span>
                    <a href="#"><img src={linearrow} alt="alt" /></a>
                </div>
            </div>
        </section>

        {/* Take Action */}
        <section className="take-action">
            <h2 className='actionBased'>Take Action Based on This Article</h2>
            <p>Prepare for 2025 with personalized predictions and cosmic guidance tailored to your chart.</p>
            <div className="action-grid">
                <div className="action-card">
                    <div className="action-icon-wrapper"><img src={report}/></div>
                    <h4>2025 Yearly Horoscope Report</h4>
                    <p>A comprehensive forecast of love, career, finances, and personal growth for the year ahead.</p>
                    <button className="cta-btn gradient-btn-alt" onClick={() => navigate("/reports")}>Generate Report</button>
                </div>
                <div className="action-card popular">
                    <span className="popular-badge">Most Popular</span>
                     <div className="action-icon-wrapper"><img src={anylysis} alt="alt" /></div>
                    <h4>Complete 2025 Astrology Guide</h4>
                    <p>Get detailed monthly predictions with insights for all major planetary transits.</p>
                    <button className="cta-btn full-btn" onClick={() => navigate("/reports")}>Get Full Analysis</button>
                </div>
                <div className="action-card">
                    <div className="action-icon-wrapper ai-chat"><img src={consultant} alt="alt"/></div>
                    <h4>AI Prediction Chat</h4>
                    <p>Chat with Aura AI to explore what 2025 holds for your sign and get tailored insights.</p>
                    <button className="cta-btn tertiary-btn" onClick={() => navigate("/chat")}>Start AI Chat - Free</button>
                </div>
                <div className="action-card">
                    <div className="action-icon-wrapper ai-chat"><img src={consultant} alt="alt"/></div>
                    <h4>AI Prediction Chat</h4>
                    <p>Chat with Aura AI to explore what 2025 holds for your sign and get tailored insights.</p>
                    <button className="cta-btn tertiary-btn" onClick={() => navigate("/chat")}>Start AI Chat - Free</button>
                </div>
            </div>
        </section>

      </main>
    </div>
  );
};

export default BlogPostPage;
