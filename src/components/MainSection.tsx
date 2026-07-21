import { FC, useState } from "react";
import { useNavigate } from 'react-router-dom';
import "./MainSection.css";


import AIBrain from '../assets/Ai-brain.png';
import Profile from '../assets/profile.svg';
import rightmark from "../assets/rightmark.svg";
import SubscriptionModal from "./SubscriptionModal";


const IconStep1SVG = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="30" height="24" viewBox="0 0 30 24" fill="none">
    <g clipPath="url(#clip0_1855_19218)">
      <path d="M4.5 6C4.5 4.4087 5.13214 2.88258 6.25736 1.75736C7.38258 0.632141 8.9087 0 10.5 0C12.0913 0 13.6174 0.632141 14.7426 1.75736C15.8679 2.88258 16.5 4.4087 16.5 6C16.5 7.5913 15.8679 9.11742 14.7426 10.2426C13.6174 11.3679 12.0913 12 10.5 12C8.9087 12 7.38258 11.3679 6.25736 10.2426C5.13214 9.11742 4.5 7.5913 4.5 6ZM0 22.6078C0 17.9906 3.74063 14.25 8.35781 14.25H12.6422C17.2594 14.25 21 17.9906 21 22.6078C21 23.3766 20.3766 24 19.6078 24H1.39219C0.623438 24 0 23.3766 0 22.6078ZM23.625 14.625V11.625H20.625C20.0016 11.625 19.5 11.1234 19.5 10.5C19.5 9.87656 20.0016 9.375 20.625 9.375H23.625V6.375C23.625 5.75156 24.1266 5.25 24.75 5.25C25.3734 5.25 25.875 5.75156 25.875 6.375V9.375H28.875C29.4984 9.375 30 9.87656 30 10.5C30 11.1234 29.4984 11.625 28.875 11.625H25.875V14.625C25.875 15.2484 25.3734 15.75 24.75 15.75C24.1266 15.75 23.625 15.2484 23.625 14.625Z" fill="white"/>
    </g>
    <defs>
      <clipPath id="clip0_1855_19218">
        <path d="M0 0H30V24H0V0Z" fill="white"/>
      </clipPath>
    </defs>
  </svg>
);

const IconStep2SVG = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
    <g clipPath="url(#clip0_1855_19228)">
      <path d="M8.625 0C10.0734 0 11.25 1.17656 11.25 2.625V21.375C11.25 22.8234 10.0734 24 8.625 24C7.27031 24 6.15469 22.9734 6.01406 21.6516C5.77031 21.7172 5.5125 21.75 5.25 21.75C3.59531 21.75 2.25 20.4047 2.25 18.75C2.25 18.4031 2.31094 18.0656 2.41875 17.7562C1.00312 17.2219 0 15.8531 0 14.25C0 12.7547 0.876562 11.4609 2.14687 10.8609C1.73906 10.35 1.5 9.70312 1.5 9C1.5 7.56094 2.5125 6.36094 3.8625 6.06562C3.7875 5.80781 3.75 5.53125 3.75 5.25C3.75 3.84844 4.71563 2.66719 6.01406 2.33906C6.15469 1.02656 7.27031 0 8.625 0ZM15.375 0C16.7297 0 17.8406 1.02656 17.9859 2.33906C19.2891 2.66719 20.25 3.84375 20.25 5.25C20.25 5.53125 20.2125 5.80781 20.1375 6.06562C21.4875 6.35625 22.5 7.56094 22.5 9C22.5 9.70312 22.2609 10.35 21.8531 10.8609C23.1234 11.4609 24 12.7547 24 14.25C24 15.8531 22.9969 17.2219 21.5812 17.7562C21.6891 18.0656 21.75 18.4031 21.75 18.75C21.75 20.4047 20.4047 21.75 18.75 21.75C18.4875 21.75 18.2297 21.7172 17.9859 21.6516C17.8453 22.9734 16.7297 24 15.375 24C13.9266 24 12.75 22.8234 12.75 21.375V2.625C12.75 1.17656 13.9266 0 15.375 0Z" fill="white"/>
    </g>
    <defs>
      <clipPath id="clip0_1855_19228">
        <path d="M0 0H24V24H0V0Z" fill="white"/>
      </clipPath>
    </defs>
  </svg>
);

const IconStep3SVG = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="30" height="24" viewBox="0 0 30 24" fill="none">
    <g clipPath="url(#clip0_1855_19238)">
      <path d="M9.75051 16.5C15.1365 16.5 19.5005 12.8062 19.5005 8.25C19.5005 3.69375 15.1365 0 9.75051 0C4.36458 0 0.000513021 3.69375 0.000513021 8.25C0.000513021 10.0594 0.689575 11.7328 1.85676 13.0969C1.6927 13.5375 1.44895 13.9266 1.19114 14.2547C0.966138 14.5453 0.736451 14.7703 0.567701 14.925C0.483326 15 0.413013 15.0609 0.366138 15.0984C0.342701 15.1172 0.32395 15.1312 0.314575 15.1359L0.305201 15.1453C0.047388 15.3375 -0.065112 15.675 0.038013 15.9797C0.141138 16.2844 0.427076 16.5 0.750513 16.5C1.77239 16.5 2.80364 16.2375 3.66145 15.9141C4.0927 15.75 4.49583 15.5672 4.84739 15.3797C6.28645 16.0922 7.95989 16.5 9.75051 16.5ZM21.0005 8.25C21.0005 13.5141 16.3552 17.4797 10.8521 17.9531C11.9911 21.4406 15.7693 24 20.2505 24C22.0411 24 23.7146 23.5922 25.1583 22.8797C25.5099 23.0672 25.9083 23.25 26.3396 23.4141C27.1974 23.7375 28.2286 24 29.2505 24C29.5739 24 29.8646 23.7891 29.963 23.4797C30.0615 23.1703 29.9536 22.8328 29.6911 22.6406L29.6818 22.6312C29.6724 22.6219 29.6536 22.6125 29.6302 22.5938C29.5833 22.5562 29.513 22.5 29.4286 22.4203C29.2599 22.2656 29.0302 22.0406 28.8052 21.75C28.5474 21.4219 28.3036 21.0281 28.1396 20.5922C29.3068 19.2328 29.9958 17.5594 29.9958 15.7453C29.9958 11.3953 26.0161 7.82812 20.9677 7.51875C20.9865 7.75781 20.9958 8.00156 20.9958 8.24531L21.0005 8.25Z" fill="white"/>
    </g>
    <defs>
      <clipPath id="clip0_1855_19238">
        <path d="M0 0H30V24H0V0Z" fill="white"/>
      </clipPath>
    </defs>
  </svg>
);

const IconFeature1SVG = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="18" viewBox="0 0 16 18" fill="none">
    <g clipPath="url(#clip0_1855_19253)">
      <path d="M15.75 2.8125V4.5C15.75 6.05391 12.2238 7.3125 7.875 7.3125C3.52617 7.3125 0 6.05391 0 4.5V2.8125C0 1.25859 3.52617 0 7.875 0C12.2238 0 15.75 1.25859 15.75 2.8125ZM13.8234 7.54805C14.5547 7.28789 15.2262 6.95391 15.75 6.54258V10.125C15.75 11.6789 12.2238 12.9375 7.875 12.9375C3.52617 12.9375 0 11.6789 0 10.125V6.54258C0.523828 6.95742 1.19531 7.28789 1.92656 7.54805C3.50508 8.11055 5.60742 8.4375 7.875 8.4375C10.1426 8.4375 12.2449 8.11055 13.8234 7.54805ZM0 12.1676C0.523828 12.5824 1.19531 12.9129 1.92656 13.173C3.50508 13.7355 5.60742 14.0625 7.875 14.0625C10.1426 14.0625 12.2449 13.7355 13.8234 13.173C14.5547 12.9129 15.2262 12.5789 15.75 12.1676V15.1875C15.75 16.7414 12.2238 18 7.875 18C3.52617 18 0 16.7414 0 15.1875V12.1676Z" fill="white"/>
    </g>
    <defs>
      <clipPath id="clip0_1855_19253">
        <path d="M0 0H15.75V18H0V0Z" fill="white"/>
      </clipPath>
    </defs>
  </svg>
);

const IconFeature2SVG = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="17" height="16" viewBox="0 0 17 16" fill="none">
  <path d="M4.46133 3.90018C6.64805 1.71346 10.1813 1.70291 12.382 3.86502L10.9336 5.30994C10.691 5.55252 10.6207 5.91463 10.7508 6.23104C10.8809 6.54744 11.1902 6.75135 11.5312 6.75135H15.7324H16.0312C16.4988 6.75135 16.875 6.37518 16.875 5.9076V1.4076C16.875 1.06658 16.6711 0.75721 16.3547 0.627132C16.0383 0.497054 15.6762 0.567366 15.4336 0.809944L13.9711 2.27244C10.8914 -0.768571 5.93086 -0.758024 2.86875 2.3076C2.01094 3.16541 1.39219 4.1744 1.0125 5.25369C0.805078 5.8408 1.11445 6.48065 1.69805 6.68807C2.28164 6.89549 2.925 6.58612 3.13242 6.00252C3.40313 5.23612 3.84258 4.51541 4.46133 3.90018ZM0 9.8451V10.1123V10.1369V14.3451C0 14.6861 0.203906 14.9955 0.520312 15.1256C0.836719 15.2556 1.19883 15.1853 1.44141 14.9428L2.90391 13.4803C5.98359 16.5213 10.9441 16.5107 14.0062 13.4451C14.8641 12.5873 15.4863 11.5783 15.866 10.5025C16.0734 9.91541 15.7641 9.27557 15.1805 9.06815C14.5969 8.86073 13.9535 9.1701 13.7461 9.75369C13.4754 10.5201 13.0359 11.2408 12.4172 11.856C10.2305 14.0428 6.69727 14.0533 4.49648 11.8912L5.94141 10.4428C6.18398 10.2002 6.2543 9.83807 6.12422 9.52166C5.99414 9.20526 5.68477 9.00135 5.34375 9.00135H1.13906H1.11445H0.84375C0.376172 9.00135 0 9.37752 0 9.8451Z" fill="white"/>
</svg>
);

const IconFeature3SVG = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none">
    <g clipPath="url(#clip0_1855_19271)">
      <path d="M9.00002 0C9.16173 0 9.32345 0.0351563 9.47111 0.101953L16.091 2.91094C16.8645 3.23789 17.441 4.00078 17.4375 4.92188C17.4199 8.40938 15.9856 14.7902 9.92814 17.6906C9.34103 17.9719 8.659 17.9719 8.07189 17.6906C2.01447 14.7902 0.580094 8.40938 0.562516 4.92188C0.559 4.00078 1.13556 3.23789 1.909 2.91094L8.53244 0.101953C8.67658 0.0351563 8.8383 0 9.00002 0ZM9.00002 2.34844V15.6375C13.8516 13.2891 15.1559 8.08945 15.1875 4.97109L9.00002 2.34844Z" fill="white"/>
    </g>
    <defs>
      <clipPath id="clip0_1855_19271">
        <path d="M0 0H18V18H0V0Z" fill="white"/>
      </clipPath>
    </defs>
  </svg>
);

const IconQuestionMarkSVG = () => (
<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none">
<g clipPath="url(#clip0_1855_19294)">
<path d="M4.2793 12.2418L3.93477 13.0484C3.42344 12.7887 2.95312 12.4688 2.52656 12.0941L3.14727 11.4734C3.48906 11.7715 3.86914 12.0312 4.2793 12.2418ZM1.11016 7.4375H0.232422C0.270703 8.01719 0.380078 8.57773 0.552344 9.1082L1.36719 8.78281C1.2332 8.35352 1.14297 7.90234 1.11016 7.4375ZM1.11016 6.5625C1.14844 6.04844 1.25234 5.55078 1.41367 5.0832L0.607031 4.73867C0.401953 5.31289 0.273438 5.92539 0.232422 6.5625H1.11016ZM1.7582 4.2793C1.97148 3.87188 2.22852 3.4918 2.52656 3.14453L1.90586 2.52383C1.53125 2.95039 1.20859 3.4207 0.951562 3.93203L1.7582 4.2793ZM10.8555 11.4734C10.4754 11.8016 10.0516 12.0832 9.59492 12.3047L9.92031 13.1195C10.4863 12.8488 11.0086 12.5016 11.4762 12.0914L10.8555 11.4734ZM3.14453 2.52656C3.52461 2.19844 3.94844 1.9168 4.40508 1.69531L4.07969 0.880469C3.51367 1.15117 2.99141 1.49844 2.52656 1.90859L3.14453 2.52656ZM12.2418 9.7207C12.0285 10.1281 11.7715 10.5082 11.4734 10.8555L12.0941 11.4762C12.4688 11.0496 12.7914 10.5766 13.0484 10.068L12.2418 9.7207ZM12.8898 7.4375C12.8516 7.95156 12.7477 8.44922 12.5863 8.9168L13.393 9.26133C13.598 8.68438 13.7266 8.07187 13.7648 7.43477H12.8898V7.4375ZM8.78281 12.6328C8.35352 12.7695 7.90234 12.857 7.4375 12.8898V13.7676C8.01719 13.7293 8.57773 13.6199 9.1082 13.4477L8.78281 12.6328ZM6.5625 12.8898C6.04844 12.8516 5.55078 12.7477 5.0832 12.5863L4.73867 13.393C5.31563 13.598 5.92813 13.7266 6.56523 13.7648V12.8898H6.5625ZM12.6328 5.21719C12.7695 5.64648 12.857 6.09766 12.8898 6.5625H13.7676C13.7293 5.98281 13.6199 5.42227 13.4477 4.8918L12.6328 5.21719ZM2.52656 10.8555C2.19844 10.4754 1.9168 10.0516 1.69531 9.59492L0.880469 9.92031C1.15117 10.4863 1.49844 11.0086 1.90859 11.4762L2.52656 10.8555ZM7.4375 1.11016C7.95156 1.14844 8.44648 1.25234 8.9168 1.41367L9.26133 0.607031C8.68711 0.401953 8.07461 0.273438 7.4375 0.232422V1.11016ZM5.21719 1.36719C5.64648 1.23047 6.09766 1.14297 6.5625 1.11016V0.232422C5.98281 0.270703 5.42227 0.380078 4.8918 0.552344L5.21719 1.36719ZM12.0941 2.52383L11.4734 3.14453C11.8016 3.52461 12.0832 3.94844 12.3074 4.40508L13.1223 4.07969C12.8516 3.51367 12.5043 2.99141 12.0941 2.52383ZM10.8555 2.52656L11.4762 1.90586C11.0496 1.53125 10.5793 1.20859 10.068 0.951562L9.72344 1.7582C10.1281 1.97148 10.5109 2.22852 10.8555 2.52656Z" fill="white"/>
<path d="M7 10.7188C7.42284 10.7188 7.76562 10.376 7.76562 9.95312C7.76562 9.53028 7.42284 9.1875 7 9.1875C6.57716 9.1875 6.23438 9.53028 6.23438 9.95312C6.23438 10.376 6.57716 10.7188 7 10.7188Z" fill="white"/>
<path d="M7.21128 8.53125H6.77378C6.59331 8.53125 6.44565 8.38359 6.44565 8.20312C6.44565 6.26172 8.56206 6.45586 8.56206 5.25547C8.56206 4.70859 8.07534 4.15625 6.99253 4.15625C6.19683 4.15625 5.7812 4.41875 5.37378 4.94102C5.26714 5.07773 5.07026 5.10508 4.93081 5.00664L4.57261 4.75508C4.41948 4.64844 4.38393 4.43242 4.50151 4.28477C5.0812 3.54102 5.77026 3.0625 6.99526 3.0625C8.42534 3.0625 9.65854 3.87734 9.65854 5.25547C9.65854 7.10391 7.54214 6.9918 7.54214 8.20312C7.5394 8.38359 7.39175 8.53125 7.21128 8.53125Z" fill="white"/>
</g>
<defs>
<clipPath id="clip0_1855_19294">
<path d="M0 0H14V14H0V0Z" fill="white"/>
</clipPath>
</defs>
</svg>
);

export const MainSection: FC = () => {

  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const goToChat = () => {
    navigate('/chat');
  };

  return (
    <div className="main-section">
      <header className="title-section">
        <h2>How Vidhi Works</h2>
        <p>
          Experience the future of astrology with our AI-powered platform that
          combines ancient wisdom with cutting-edge technology to deliver
          personalized cosmic insights.
        </p>
      </header>

      <section className="precision-section card-glass">
        <h3>Precision You Can Trust</h3>
        <p>
          Our AI model delivers industry-leading accuracy in astrological
          predictions.
        </p>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-circle-large gradient-pink-purple">
                94%
            </div>
            <h4>Prediction Accuracy</h4>
            <small>Based on 10M+ predictions</small>
          </div>

          <div className="stat-card">
            <div className="stat-circle-large gradient-purple-blue">
                1K+
            </div>
            <h4>Active Users</h4>
            <small>Trust our insights daily</small>
          </div>

          <div className="stat-card">
            <div className="stat-circle-large gradient-blue-teal">
                24/7
            </div>
            <h4>AI Availability</h4>
            <small>Always ready to help</small>
          </div>

          <div className="stat-card">
            <div className="stat-circle-large gradient-teal-green">
                0.2s
            </div>
            <h4>Response Time</h4>
            <small>Lightning-fast insights</small>
          </div>
        </div>
      </section>

      <section className="steps-section card-glass">
        <h3>Simple as 1-2-3</h3>
        <div className="steps">
          <div className="step">
            <div className="icon-circle-medium gradient-pink-purple">
                 <IconStep1SVG />
            </div>
            <h4>1. Share Your Details</h4>
            <p>
              Provide your birth date, time, and location. Our AI uses this data
              to create your unique astrological profile and birth chart
              analysis.
            </p>
          </div>

          
          <div className="step">
            <div className="icon-circle-medium gradient-purple-blue">
                <IconStep2SVG />
            </div>
            <h4>2. AI Analysis</h4>
            <p>
              Our advanced AI processes thousands of astrological data points,
              planetary positions, and cosmic patterns to generate personalized
              insights.
            </p>
          </div>

          <div className="step">
            <div className="icon-circle-medium gradient-blue-teal">
                <IconStep3SVG />
            </div>
            <h4>3. Chat & Discover</h4>
            <p>
              Ask questions just like chatting with a friend. Get instant,
              accurate predictions about love, career, health, and your future
              path.
            </p>
          </div>
        </div>
      </section>


      <section className="advanced-ai-section card-glass">
        <h3>Advanced AI Model</h3>
        <div className="ai-layout">
          <div className="ai-features">
            <div className="feature">
              <div className="icon-circle-medium gradient-pink-purple flex-shrink-0">
                <IconFeature1SVG />
              </div>
              <div className="feature-content">
                <h4>Massive Dataset Training</h4>
                <p>
                  Trained on millions of astrological charts, historical
                  predictions, and verified outcomes spanning centuries of cosmic
                  wisdom.
                </p>
              </div>
            </div>

            <div className="feature">
              <div className="icon-circle-medium gradient-purple-blue flex-shrink-0">
                <IconFeature2SVG />
              </div>
              <div className="feature-content">
                <h4>Real-Time Updates</h4>
                <p>
                  Continuously learns from planetary movements, user feedback, and
                  prediction outcomes to improve accuracy.
                </p>
              </div>
            </div>

            <div className="feature">
              <div className="icon-circle-medium gradient-blue-teal flex-shrink-0">
                <IconFeature3SVG />
              </div>
              <div className="feature-content">
                <h4>Privacy Protected</h4>
                <p>
                  Your personal data is encrypted and secure. We never share your
                  information with third parties.
                </p>
              </div>
            </div>
          </div>

          <div className="ai-image">
            <img src={AIBrain} alt="AI Brain" />
          </div>
        </div>
      </section>

      <section className="conversation-section card-glass">
        <h3>Natural Conversation Experience</h3>
        <div className="conversation-wrapper">
          <div className="conversation-example">
            <div className="user-message">
              <div className="user-header">
                <img src={Profile} alt="User" />
                <strong>You:</strong>
              </div>
              <p>
                "What does my birth chart say about my career prospects this
                year?"
              </p>
            </div>

            <div className="ai-message">
              <div className="submessage">
                <div className="avatar-circle gradient-pink-purple">
                  <IconQuestionMarkSVG />
                </div>
                <strong>Vidhi AI:</strong>
              </div>
              <div>
                <p>
                  Based on your birth chart, Jupiter's transit through your 10th
                  house suggests significant career advancement opportunities in Q2
                  2024. Your Saturn placement indicates that hard work will pay
                  off...
                </p>
              </div>
            </div>
          </div>


          <ul className="conversation-benefits">
            <li>
              <div className="icon-circle-small gradient-teal-green">
                  <img src={rightmark} alt="✔" className="white-icon-small" />
              </div>
               Ask anything in natural language
            </li>
            <li>
              <div className="icon-circle-small gradient-teal-green">
                  <img src={rightmark} alt="✔" className="white-icon-small" />
              </div>
               Get detailed, personalized responses
            </li>
            <li>
              <div className="icon-circle-small gradient-teal-green">
                  <img src={rightmark} alt="✔" className="white-icon-small" />
              </div>
               Follow-up questions encouraged
            </li>
            <li>
              <div className="icon-circle-small gradient-teal-green">
                  <img src={rightmark} alt="✔" className="white-icon-small" />
              </div>
               Voice and text input supported
            </li>
            <li>
              <div className="icon-circle-small gradient-teal-green">
                  <img src={rightmark} alt="✔" className="white-icon-small" />
              </div>
               Context-aware conversations
            </li>
          </ul>
        </div>
      </section>


      <section className="engagement-section card-glass">
        <h3>Ready to Unlock Your Cosmic Potential?</h3>
        <p className="engagement-line"> 
          Join millions who trust Vidhi for accurate, personalized
          astrological guidance.
        </p>
        <div className="cta-buttons">
          <button className="primary-btn" onClick={goToChat}>Start Free Chat</button>
          <button className="secondary-btn" onClick={() => setIsModalOpen(true)}>View Pricing</button>
          <SubscriptionModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
          />
        </div>
      </section>
    </div>
  );
};