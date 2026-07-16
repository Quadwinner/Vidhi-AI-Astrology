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
import BlogBackground from '../assets/img2.png';
import BlogProfile from '../assets/BlogProfile.svg';
import Bluechat from '../assets/Bluechat.png';
import { useNavigate } from 'react-router-dom';

const FireSignsBlog: React.FC = () => {
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
            <span>Featured</span>
            <span className="dot">•</span>
            <span className='small-title'>September 9, 2024</span>
            <span className="dot">•</span>
            <span className='small-title'>8 min read</span>
            <span className="dot">•</span>
            <span className='small-title'>By Dr. Sarah Chen</span>
          </div>
          <h1 className='blog-title'>The Fire Signs: Aries, Leo, and Sagittarius Personality Traits</h1>
          <p className="subtitle">
            Fire signs — Aries, Leo, and Sagittarius — radiate boldness, energy, and creativity. Learn how to align your inner fire to manifest goals, express yourself authentically, and overcome challenges.
          </p>
          <img src={BlogBackground} alt="Fire energy illustration" className='BlogBackground' />
          <p className='below-subtitle'>
            The Fire element symbolizes passion, courage, and action. By embracing your fire sign traits, you can tap into leadership, motivation, and unstoppable determination.
          </p>
        </section>

        {/* Main Content */}
        <div className="blog-content">
          <h2 className='mercury-title'>Understanding Fire Sign Personality Traits</h2>
          <p>
            Aries, Leo, and Sagittarius are naturally energetic, adventurous, and confident. They thrive when taking initiative, expressing creativity, and leading others toward ambitious goals.
          </p>
          <p>
            Fire signs are fearless, often inspiring those around them. Their enthusiasm can ignite change and motivate action, making them natural catalysts for transformation.
          </p>

          <h2 className='mercury-title'>Fire Sign Rituals for Manifestation</h2>
          <p>Boost your fire sign energy with these rituals:</p>
          <ul className="retrograde-dates">
            <li>
              <strong>Power Journaling:</strong>
              <span> Write down bold intentions and affirm your confidence, passion, and goals.</span>
            </li>
            <li>
              <strong>Fire Candle Ritual:</strong>
              <span> Light a red or orange candle and visualize your energy fueling your ambitions.</span>
            </li>
            <li>
              <strong>Dynamic Movement:</strong>
              <span> Engage in activities like dance, running, or yoga to ignite energy and motivation.</span>
            </li>
          </ul>

          <h2 className='shadow'>Aligning with Fire Cycles</h2>
          <p>
            Fire signs resonate with periods of action and growth. Use high-energy times to start projects, take risks, and embrace leadership opportunities. Reflect during calmer moments to recharge your inner flame and plan your next bold moves.
          </p>
        </div>

        {/* Personal Report CTA */}
        <section className="cta-card personal-report-cta">
          <div>
            <h3>Get Your Personalized Fire Sign Guide</h3>
            <p>Discover how your Aries, Leo, or Sagittarius energy can be maximized each month for manifestation, confidence, and leadership.</p>
            <button className="cta-btn gradient-btn" onClick={() => navigate("/reports")}>Generate My Fire Guide</button>
          </div>
          <img src={TrendingUp} className="cta-icon" />
        </section>

        {/* Fire Effects on Zodiac */}
        <section className="zodiac-effects">
            <h2 className='mercury-titles'>Fire Sign Insights</h2>
            <div className="zodiac-grid">
                <div className="zodiac-card">
                    <h4 className='fire'>Aries</h4>
                    <p>Bold and adventurous, Aries thrives on challenges and taking initiative. Use your energy to start new projects and lead with courage.</p>
                </div>
                <div className="zodiac-card">
                    <h4 className='fire'>Leo</h4>
                    <p>Confident and creative, Leo shines in leadership roles and self-expression. Channel your energy into inspiring others and pursuing your passions.</p>
                </div>
                <div className="zodiac-card">
                    <h4 className='fire'>Sagittarius</h4>
                    <p>Optimistic and adventurous, Sagittarius seeks growth and exploration. Use your curiosity and enthusiasm to expand your horizons and manifest dreams.</p>
                </div>
            </div>
        </section>

        {/* Author Bio */}
        <section className="author-bio">
            <img src={BlogProfile} alt="Dr. Sarah Chen" className='blogProfile' />
            <div className="author-details">
                <h3>Dr. Sarah Chen</h3>
                <p className="author-title">Certified Astrologer & Fire Sign Specialist</p>
                <div className="author-stats">
                    <span><img src={Yellowstar} className='star'/>4.9 Rating</span>
                    <span className='exp'><img src={people}  /> 15+ Years Experience</span>
                </div>
                <p className="author-description">
                    Dr. Sarah Chen specializes in guiding Fire Signs — Aries, Leo, and Sagittarius — to harness their bold energy, boost confidence, and manifest goals aligned with their fiery nature.
                </p>
            </div>
        </section>

        {/* Chat with AI */}
        <section className="cta-card chat-ai-cta">
            <img src={Bluechat} alt="Fire Chat" />
            <div className="chat-content">
                <h3>Chat with Aura AI About Your Fire Sign Energy</h3>
                <p>Ask Aura AI how your fire traits can enhance your personal growth, manifestation, and leadership abilities.</p>
                <button className="cta-btn secondary-btn" onClick={() => navigate("/chat")}>Start AI Chat Now</button>
            </div>
        </section>

        {/* Related Fire Articles */}
        <section className="related-articless">
            <h2 className="like">You Might Also Like</h2>
            <div className="articless-grid">
                <div className="article-card">
                    <div className="article-icon-wrapper"><img src={transist}/></div>
                    <h4>Fire Sign Daily Rituals</h4>
                    <p>Simple daily practices to boost your energy, motivation, and confidence as a fire sign.</p>
                    <span>5 min read</span>
                    <a href="#"><img src={linearrow} alt="arrow"/></a>
                </div>
                <div className="article-card">
                    <div className="article-icon-wrapper calendar"><img src={forecast} alt="alt" /></div>
                    <h4>Manifestation Tips for Fire Signs</h4>
                    <p>Harness bold energy to set powerful intentions and achieve your goals quickly.</p>
                    <span>7 min read</span>
                    <a href="#"><img src={linearrow} alt="arrow"/></a>
                </div>
                <div className="article-card">
                    <div className="article-icon-wrapper aiforecast"><img src={forecast} alt="alt" /></div>
                    <h4>Leadership Insights for Fire Signs</h4>
                    <p>Learn how Aries, Leo, and Sagittarius can lead with passion, confidence, and inspiration.</p>
                    <span>8 min read</span>
                    <a href="#"><img src={linearrow} alt="arrow"/></a>
                </div>
            </div>
        </section>

        {/* Take Action */}
        <section className="take-action">
            <h2 className='actionBased'>Take Action Based on This Fire Article</h2>
            <p>Leverage your fire sign energy with personalized rituals, reports, and AI guidance.</p>
            <div className="action-grid">
                <div className="action-card">
                    <div className="action-icon-wrapper"><img src={report}/></div>
                    <h4>Fire Sign Ritual Report</h4>
                    <p>Step-by-step guide to using your fire energy for manifestation and bold action.</p>
                    <button className="cta-btn gradient-btn-alt" onClick={() => navigate("/reports")}>Generate Report</button>
                </div>
                <div className="action-card popular">
                    <span className="popular-badge">Most Popular</span>
                     <div className="action-icon-wrapper"><img src={anylysis} alt="alt" /></div>
                    <h4>Complete Fire Energy Analysis</h4>
                    <p>Insights on maximizing your energy as Aries, Leo, or Sagittarius for every phase of life.</p>
                    <button className="cta-btn full-btn" onClick={() => navigate("/reports")}>Get Full Analysis</button>
                </div>
                <div className="action-card">
                    <div className="action-icon-wrapper ai-chat"><img src={consultant} alt="alt"/></div>
                    <h4>AI Fire Guidance</h4>
                    <p>Chat with Aura AI for tips on manifesting, leading, and thriving as a fire sign.</p>
                    <button className="cta-btn tertiary-btn" onClick={() => navigate("/chat")}>Start AI Chat - Free</button>
                </div>
                 <div className="action-card">
                    <div className="action-icon-wrapper ai-chat"><img src={consultant} alt="alt"/></div>
                    <h4>AI Fire Guidance</h4>
                    <p>Chat with Aura AI for tips on manifesting, leading, and thriving as a fire sign.</p>
                    <button className="cta-btn tertiary-btn" onClick={() => navigate("/chat")}>Start AI Chat - Free</button>
                </div>
            </div>
        </section>

      </main>
    </div>
  );
};

export default FireSignsBlog;
