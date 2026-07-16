// src/index.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

import * as amplitude from '@amplitude/analytics-browser';
import { init } from '@amplitude/analytics-browser';
import { Experiment } from '@amplitude/experiment-js-client';

import './clevertapClient';
import { register as registerServiceWorker } from './utils/serviceWorkerRegistration';

// Create a global amplitudeApp container
export const amplitudeApp: any = {};

console.log("[CleverTap] Runtime env check", {
  accountId: process.env.REACT_APP_CLEVERTAP_ACCOUNT_ID,
  region: process.env.REACT_APP_CLEVERTAP_REGION,
});

// ---- 1. ANALYTICS INIT ----
const AMPLITUDE_API_KEY = process.env.REACT_APP_AMPLITUDE_API_KEY;

if (AMPLITUDE_API_KEY) {
  init(AMPLITUDE_API_KEY, undefined, {
    defaultTracking: {
      pageViews: false,
      sessions: true,
      formInteractions: true,
      fileDownloads: true,
    },
  });

  console.log("[Amplitude] Analytics initialized");
} else {
  console.error("Missing REACT_APP_AMPLITUDE_API_KEY");
}

// ---- 2. EXPERIMENT INIT (USING THE SAME PROJECT API KEY) ----
if (AMPLITUDE_API_KEY) {
  amplitudeApp.experiment = Experiment.initializeWithAmplitudeAnalytics(
    AMPLITUDE_API_KEY
  );

  console.log(
    "[Amplitude] Experiment initialized with Project API Key (FLAG CLIENT READY)"
  );
} else {
  console.error("Amplitude Experiment Key missing");
}

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// ---- 3. SERVICE WORKER REGISTRATION FOR CLEVERTAP WEB PUSH ----
registerServiceWorker({
  onSuccess: () => {
    console.log('[CleverTap] Service worker registered successfully');
  },
  onUpdate: (registration) => {
    console.log('[CleverTap] New service worker version available');
    // Optionally notify user about update
  },
  onError: (error) => {
    console.error('[CleverTap] Service worker registration failed:', error);
  },
});
