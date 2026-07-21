// src/firebaseClient.ts
import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: 'AIzaSyCKIjJrvpcI03LFkVHkkPEz1opIEGNjjYM',
  authDomain: 'astro-500910.firebaseapp.com',
  projectId: 'astro-500910',
  storageBucket: 'astro-500910.firebasestorage.app',
  messagingSenderId: '747140773728',
  appId: '1:747140773728:web:036763dd454eeb1da49005',
};

export const app = initializeApp(firebaseConfig);

export const initFirebaseAnalytics = async () => {
  try {
    if (typeof window !== 'undefined' && (await isSupported())) {
      return getAnalytics(app);
    }
  } catch {
    // ignore analytics init failures
  }
  return null;
};


