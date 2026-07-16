// src/firebaseClient.ts
import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: 'AIzaSyDq4UODoqgepbdqFu47_jtrZOo-JQkNfn0',
  authDomain: 'astroauraai-b41b5.firebaseapp.com',
  projectId: 'astroauraai-b41b5',
  storageBucket: 'astroauraai-b41b5.firebasestorage.app',
  messagingSenderId: '758396763149',
  appId: '1:758396763149:web:b728780a88354c1d2a2944',
  measurementId: 'G-NQS09N6G3R'
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


