export const SITE_URL = 'https://vidhi-ai-astrology.vercel.app';
export const SITE_NAME = 'Vidhi';
export const DEFAULT_IMAGE = `${SITE_URL}/logo192.png`;

export interface SeoMeta {
  title: string;
  description: string;
  keywords?: string;
  image?: string;
  type?: 'website' | 'article';
  noindex?: boolean;
}

export const DEFAULT_SEO: SeoMeta = {
  title: 'Vidhi - AI Astrology App & Personalized Horoscope',
  description:
    'Explore Vidhi, the AI Vedic astrology app for personalized horoscopes, Kundli birth charts, matching, and live voice guidance powered by AI.',
  keywords:
    'AI astrology app, personalized horoscope, AI horoscope, astrology app, birth chart calculator, natal chart reading, kundli matching, tarot reading online, panchang, numerology, gemstones, AI astrologer',
  type: 'website',
};

export const ROUTE_SEO: Record<string, SeoMeta> = {
  '/': {
    title: 'Vidhi - AI Astrology App & Personalized Horoscope',
    description:
      'Unlock your cosmic potential with Vidhi. AI-powered Vedic astrology, Kundli birth charts, daily predictions, and live voice guidance personalized for you.',
    keywords:
      'AI astrology app, personalized horoscope, AI horoscope, birth chart calculator, natal chart reading, Vedic astrology, AI astrologer',
    type: 'website',
  },
  '/how-it-works': {
    title: 'How Vidhi Works | AI Vedic Astrology Explained',
    description:
      'See how Vidhi combines Vedic astrology with AI to deliver accurate Kundli readings, planetary insights, and personalized guidance in seconds.',
    keywords: 'how astrology app works, AI astrology, Vedic astrology guide',
    type: 'website',
  },
  '/blog': {
    title: 'Astrology Blog | Cosmic Insights & Predictions | Vidhi',
    description:
      'Read the Vidhi blog for astrology insights, planetary transits, tarot guidance, and cosmic forecasts to navigate your day with clarity.',
    keywords: 'astrology blog, cosmic insights, planetary transits, horoscope articles',
    type: 'website',
  },
  '/rashifal': {
    title: 'Daily Rashifal | Free Horoscope Predictions | Vidhi',
    description:
      'Get your daily Rashifal and free horoscope predictions for every zodiac sign, powered by AI Vedic astrology on Vidhi.',
    keywords: 'rashifal, daily horoscope, zodiac predictions, free horoscope, aaj ka rashifal',
    type: 'website',
  },
  '/tarot': {
    title: 'Free AI Tarot Reading Online | Vidhi',
    description:
      'Discover guidance with a free AI tarot reading on Vidhi. Draw your cards and reveal insights on love, career, and life decisions.',
    keywords: 'tarot reading online, AI tarot reading, free tarot reading, tarot cards',
    type: 'website',
  },
  '/kundli-matching': {
    title: 'Free Kundli Matching & Compatibility | Vidhi',
    description:
      'Check marriage compatibility with free Kundli matching on Vidhi. AI-powered Guna Milan and synastry analysis for lasting relationships.',
    keywords: 'kundli matching, marriage compatibility, guna milan, horoscope matching, synastry',
    type: 'website',
  },
  '/panchang': {
    title: 'Today Panchang | Tithi, Nakshatra & Muhurat | Vidhi',
    description:
      "Check today's Panchang on Vidhi with accurate Tithi, Nakshatra, Yoga, and auspicious Muhurat timings for your location.",
    keywords: 'panchang, today panchang, tithi, nakshatra, shubh muhurat, hindu calendar',
    type: 'website',
  },
  '/doshas': {
    title: 'Dosha Analysis | Mangal, Kaal Sarp & More | Vidhi',
    description:
      'Understand doshas in your birth chart with Vidhi. AI analysis of Mangal Dosha, Kaal Sarp Dosha, and remedies for balance.',
    keywords: 'dosha analysis, mangal dosha, kaal sarp dosha, pitra dosha, astrology remedies',
    type: 'website',
  },
  '/numerology': {
    title: 'Free Numerology Calculator & Report | Vidhi',
    description:
      'Reveal your life path, destiny, and lucky numbers with Vidhi numerology. Get a free AI-powered numerology report instantly.',
    keywords: 'numerology, numerology calculator, life path number, destiny number, lucky numbers',
    type: 'website',
  },
  '/gemstones': {
    title: 'Gemstone Recommendations by Birth Chart | Vidhi',
    description:
      'Find the right gemstone for your birth chart with Vidhi. AI-guided recommendations for planetary strength and well-being.',
    keywords: 'gemstone recommendation, astrology gemstones, birthstone, planetary gemstones',
    type: 'website',
  },
  '/privacy-policy': {
    title: 'Privacy Policy | Vidhi',
    description: 'Read the Vidhi privacy policy to understand how we collect, use, and protect your data.',
    type: 'website',
  },
  '/terms-and-conditions': {
    title: 'Terms and Conditions | Vidhi',
    description: 'Review the terms and conditions for using the Vidhi AI astrology platform.',
    type: 'website',
  },
};

const NOINDEX_META = (title: string): SeoMeta => ({
  title,
  description: DEFAULT_SEO.description,
  noindex: true,
  type: 'website',
});

const NOINDEX_ROUTES: Record<string, SeoMeta> = {
  '/profiles': NOINDEX_META('My Profiles | Vidhi'),
  '/profiles/new': NOINDEX_META('Create Profile | Vidhi'),
  '/reports': NOINDEX_META('Reports | Vidhi'),
  '/account': NOINDEX_META('Account | Vidhi'),
  '/wallet': NOINDEX_META('Wallet | Vidhi'),
  '/subscription-management': NOINDEX_META('Manage Subscription | Vidhi'),
  '/chat': NOINDEX_META('Chat | Vidhi'),
  '/remedies': NOINDEX_META('Remedies | Vidhi'),
  '/quick-recharge': NOINDEX_META('Quick Recharge | Vidhi'),
  '/payment-success': NOINDEX_META('Payment Success | Vidhi'),
  '/debug': NOINDEX_META('Debug | Vidhi'),
  '/admin': NOINDEX_META('Admin | Vidhi'),
  '/admin-check': NOINDEX_META('Admin Check | Vidhi'),
};

const SELF_MANAGED_PREFIXES = ['/blog/'];

export function isSelfManaged(pathname: string): boolean {
  if (pathname === '/blog') return false;
  return SELF_MANAGED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function buildCanonical(pathname: string): string {
  if (pathname === '/' || pathname === '') return `${SITE_URL}/`;
  const clean = pathname.replace(/\/+$/, '');
  return `${SITE_URL}${clean}`;
}

export function getSeoForPath(pathname: string): SeoMeta {
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return ROUTE_SEO[clean] || NOINDEX_ROUTES[clean] || { ...DEFAULT_SEO, noindex: true };
}
