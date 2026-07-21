import React from 'react';
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
import BlogBackground from '../assets/img3.png';
import BlogProfile from '../assets/BlogProfile.svg';
import Bluechat from '../assets/Bluechat.png';
import {useNavigate } from 'react-router-dom';



const FullMoonBlog: React.FC = () => {
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
            <span className='small-title'>January 12, 2024</span>
            <span className="dot">•</span>
            <span className='small-title'>7 min read</span>
            <span className="dot">•</span>
            <span className='small-title'>By Dr. Sarah Chen</span>
          </div>
          <h1 className='blog-title'>Harnessing Full Moon Energy for Manifestation and Release</h1>
          <p className="subtitle">
            The full moon is a powerful time for reflection, release, and manifestation. Learn how to align your intentions with lunar energy to let go of what no longer serves you and call in what you truly desire.
          </p>
          <img src={BlogBackground} alt="alt" className='BlogBackground' />
          <p className='below-subtitle'>
            For centuries, cultures around the world have honored the full moon as a sacred time for rituals, clarity, and transformation. By understanding the cycles of the moon, you can work in harmony with the cosmos to create meaningful change in your life.
          </p>
        </section>

        {/* Main Content */}
        <div className="blog-content">
          <h2 className='mercury-title'>The Spiritual Meaning of the Full Moon</h2>
          <p>
            The full moon represents completion, illumination, and heightened emotions. It shines light on areas of your life that need attention and offers the perfect opportunity to release limiting beliefs, toxic patterns, and fears.
          </p>
          <p>
            At the same time, it amplifies manifestation energy, making it a powerful phase for setting intentions and visualizing your goals. Many spiritual traditions recommend performing release rituals under the full moon to create space for new blessings.
          </p>

          <h2 className='mercury-title'>Full Moon Ritual Ideas</h2>
          <p>Here are some practices to harness the energy of the full moon:</p>
          <ul className="retrograde-dates">
            <li>
              <strong>Journaling:</strong>
              <span> Write down what you want to release and what you want to attract into your life.</span>
            </li>
            <li>
              <strong>Candle or Fire Ritual:</strong>
              <span> Safely burn a paper with old fears or habits to symbolize letting go.</span>
            </li>
            <li>
              <strong>Meditation:</strong>
              <span> Visualize your intentions while sitting under the moonlight.</span>
            </li>
          </ul>

          <h2 className='shadow'>Working with Moon Cycles</h2>
          <p>
            The full moon is just one part of the lunar cycle. By aligning your energy with the phases of the moon — new moon for beginnings, full moon for manifestation, waning moon for release — you can create balance and flow in all areas of life.
          </p>
        </div>

        {/* Personal Report CTA */}
        <section className="cta-card personal-report-cta">
          <div>
            <h3>Get Your Personalized Full Moon Manifestation Guide</h3>
            <p>Discover how each full moon of the year affects your zodiac sign and how to maximize its energy.</p>
            <button className="cta-btn gradient-btn" onClick={() => navigate("/reports")}>Generate My Guide</button>
          </div>
          <img src={TrendingUp} className="cta-icon" />
        </section>

        {/* Effects on Zodiac */}
        <section className="zodiac-effects">
            <h2 className='mercury-titles'>Full Moon Effects on Each Zodiac Sign</h2>
            <div className="zodiac-grid">
                <div className="zodiac-card">
                    <h4 className='fire'>Fire Signs</h4>
                    <p>Aries, Leo, Sagittarius feel energized to manifest bold goals and release impulsive behaviors.</p>
                </div>
                <div className="zodiac-card">
                    <h4 className='earth'>Earth Signs</h4>
                    <p>Taurus, Virgo, Capricorn gain clarity in career and finances but may need to release rigidity.</p>
                </div>
                <div className="zodiac-card">
                    <h4 className='air'>Air Signs</h4>
                    <p>Gemini, Libra, Aquarius experience heightened creativity and may need to release distractions.</p>
                </div>
                <div className="zodiac-card">
                    <h4 className='water'>Water Signs</h4>
                    <p>Cancer, Scorpio, Pisces feel deep emotional waves and benefit from releasing past wounds.</p>
                </div>
                <div className="zodiac-card">
                    <h4 className='air'>Air Signs</h4>
                    <p>Gemini, Libra, Aquarius experience heightened creativity and may need to release distractions.</p>
                </div>
                <div className="zodiac-card">
                    <h4 className='water'>Water Signs</h4>
                    <p>Cancer, Scorpio, Pisces feel deep emotional waves and benefit from releasing past wounds.</p>
                </div>
            </div>
        </section>

        {/* Author Bio */}
        <section className="author-bio">
            <img src={BlogProfile} alt="Dr. Sarah Chen" className='blogProfile' />
            <div className="author-details">
                <h3>Dr. Sarah Chen</h3>
                <p className="author-title">Certified Astrologer & Lunar Energy Expert</p>
                <div className="author-stats">
                    <span><img src={Yellowstar} className='star'/>4.9 Rating</span>
                    <span className='exp'><img src={people}  /> 15+ Years Experience</span>
                </div>
                <p className="author-description">
                    Dr. Sarah Chen has guided thousands through moon rituals and astrological insights. Her expertise helps people harness lunar energy for spiritual growth, manifestation, and emotional balance.
                </p>
            </div>
        </section>

        {/* Chat with AI */}
        <section className="cta-card chat-ai-cta">
            <img src={Bluechat} alt="alt" />
            <div className="chat-content">
                <h3>Chat with Vidhi AI About the Full Moon</h3>
                <p>Ask Vidhi AI how the full moon will affect your zodiac sign and what rituals are best for you.</p>
                <button className="cta-btn secondary-btn" onClick={() => navigate("/chat")}>Start AI Chat Now</button>
            </div>
        </section>

        {/* You Might Also Like */}
        <section className="related-articless">
            <h2 className="like">You Might Also Like</h2>
            <div className="articless-grid">
                <div className="article-card">
                    <div className="article-icon-wrapper"><img src={transist}/></div>
                    <h4>New Moon Rituals</h4>
                    <p>Discover how to set fresh intentions and plant seeds for new beginnings.</p>
                    <span>6 min read</span>
                    <a href="#"><img src={linearrow} alt="alt"/></a>
                </div>
                <div className="article-card">
                    <div className="article-icon-wrapper calendar"><img src={forecast} alt="alt" /></div>
                    <h4>Lunar Eclipse Insights</h4>
                    <p>Learn the transformative power of eclipses and their impact on your destiny.</p>
                    <span>9 min read</span>
                    <a href="#"><img src={linearrow} alt="alt"/></a>
                </div>
                <div className="article-card">
                    <div className="article-icon-wrapper aiforecast"><img src={forecast} alt="alt" /></div>
                    <h4>Astrology for Manifestation</h4>
                    <p>Align your goals with planetary movements for maximum success.</p>
                    <span>11 min read</span>
                    <a href="#"><img src={linearrow} alt="alt" /></a>
                </div>
            </div>
        </section>

        {/* Take Action */}
        <section className="take-action">
            <h2 className='actionBased'>Take Action Based on This Article</h2>
            <p>Harness lunar energy with personalized rituals and reports tailored to your birth chart.</p>
            <div className="action-grid">
                <div className="action-card">
                    <div className="action-icon-wrapper"><img src={report}/></div>
                    <h4>Full Moon Ritual Report</h4>
                    <p>Step-by-step guide to performing powerful full moon rituals for manifestation and release.</p>
                    <button className="cta-btn gradient-btn-alt" onClick={() => navigate("/reports")}>Generate Report</button>
                </div>
                <div className="action-card popular">
                    <span className="popular-badge">Most Popular</span>
                     <div className="action-icon-wrapper"><img src={anylysis} alt="alt" /></div>
                    <h4>Complete Lunar Cycle Analysis</h4>
                    <p>Get insights for every moon phase — new moon, full moon, and eclipses — based on your chart.</p>
                    <button className="cta-btn full-btn" onClick={() => navigate("/reports")}>Get Full Analysis</button>
                </div>
                <div className="action-card">
                    <div className="action-icon-wrapper ai-chat"><img src={consultant} alt="alt"/></div>
                    <h4>AI Moon Guidance</h4>
                    <p>Chat with Vidhi AI to receive customized full moon rituals and manifestation tips.</p>
                    <button className="cta-btn tertiary-btn" onClick={() => navigate("/chat")}>Start AI Chat - Free</button>
                </div>
                 <div className="action-card">
                    <div className="action-icon-wrapper ai-chat"><img src={consultant} alt="alt"/></div>
                    <h4>AI Moon Guidance</h4>
                    <p>Chat with Vidhi AI to receive customized full moon rituals and manifestation tips.</p>
                    <button className="cta-btn tertiary-btn" onClick={() => navigate("/chat")}>Start AI Chat - Free</button>
                </div>
            </div>
        </section>

      </main>
    </div>
  );
};

export default FullMoonBlog;
