import { IconBrandInstagram, IconBrandYoutube, IconMinus, IconPlus } from '@tabler/icons-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ReactComponent as Logo } from '../assets/logo.svg';
import { useAuth } from '../context/AuthContext';
import styles from './Footer.module.css';
import FooterEmailBanner from './FooterEmailBanner';

export default function Footer() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const { user, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  const toggleAccordion = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  const handleProtectedLinkClick = (path: string) => {
    if (user) {
      navigate(path);
    } else {
      signInWithGoogle();
    }
  };

  const accordionData = [
    {
      title: 'Features',
      links: [
        { text: 'Birth Chart', path: '/reports', protected: true },
        { text: 'Daily Predictions', path: '/chat', protected: true },
        { text: 'Compatibility', path: '/reports', protected: true },
        { text: 'AI Chat', path: '/chat', protected: true },
        { text: 'Remedies', path: '/chat', protected: true },
      ],
    },
    {
      title: 'Insights',
      links: [
        { text: 'Career Guidance', path: '/chat', protected: true },
        { text: 'Love Life', path: '/reports', protected: true },
        { text: 'Health Insights', path: '/reports', protected: true },
        { text: 'Financial Forecast', path: '/reports', protected: true },
        { text: 'Spiritual Growth', path: '/reports', protected: true },
      ],
    },
    {
      title: 'Support',
      links: [
        { text: 'FAQ', path: '/#faq', protected: false },
        { text: 'Contact Us', path: 'mailto:contact@astroaura.ai', protected: false },
        { text: 'Terms of Service', path: '/terms-and-conditions', protected: false },
        { text: 'Privacy Policy', path: '/privacy-policy', protected: false },
      ],
    },
  ];

  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        {/* Newsletter */}
        <FooterEmailBanner />

        {/* Main footer grid: brand + link columns */}
        <div className={styles.main}>
          <div className={styles.brand}>
            <Link to="/" className={styles.logo}>
              <Logo className={styles.logoSvg} />
              <span>Vidhi</span>
            </Link>
            <p className={styles.description}>
              Your trusted AI-powered Vedic astrology companion — personalized insights,
              guidance, and cosmic clarity for every step of your journey.
            </p>
            <div className={styles.socials}>
              <a href="#" aria-label="Instagram" className={styles.socialIcon}><IconBrandInstagram size={20} /></a>
              <a href="#" aria-label="YouTube" className={styles.socialIcon}><IconBrandYoutube size={20} /></a>
            </div>
          </div>

          <nav className={styles.links}>
            {accordionData.map((col, index) => (
              <div className={styles.column} key={col.title}>
                <button
                  className={styles.accordionHeader}
                  onClick={() => toggleAccordion(index)}
                  aria-expanded={openIndex === index}
                >
                  <h3 className={styles.columnTitle}>{col.title}</h3>
                  {openIndex === index ? <IconMinus size={18} /> : <IconPlus size={18} />}
                </button>

                <ul className={`${styles.linkList} ${openIndex === index ? styles.open : ''}`}>
                  {col.links.map((link) => {
                    const isExternal = link.path.startsWith('mailto:') || link.path.startsWith('http');
                    return (
                      <li key={link.text}>
                        {link.protected ? (
                          <a
                            href={link.path}
                            onClick={(e) => {
                              e.preventDefault();
                              handleProtectedLinkClick(link.path);
                            }}
                          >
                            {link.text}
                          </a>
                        ) : isExternal ? (
                          <a href={link.path}>{link.text}</a>
                        ) : (
                          <Link to={link.path}>{link.text}</Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        {/* Bottom bar */}
        <div className={styles.footerBottom}>
          <p>© {new Date().getFullYear()} Vidhi. All rights reserved.</p>
          <div className={styles.bottomLinks}>
            <Link to="/privacy-policy">Privacy Policy</Link>
            <span className={styles.dot} aria-hidden="true">•</span>
            <Link to="/terms-and-conditions">Terms of Service</Link>
            <span className={styles.dot} aria-hidden="true">•</span>
            <a href="mailto:contact@astroaura.ai" className={styles.emailLink}>contact@astroaura.ai</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
