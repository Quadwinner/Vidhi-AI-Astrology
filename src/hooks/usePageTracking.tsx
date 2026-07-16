// src/hooks/usePageTracking.tsx

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { track } from '@amplitude/analytics-browser';

// A simple mapping to make our event names more readable in Amplitude
const pageNameMapping: { [key: string]: string } = {
  '/': 'Home',
  '/how-it-works': 'How It Works',
  '/blog': 'Blog',
  '/profiles': 'Profile Dashboard',
  '/profiles/new': 'Create Profile',
  '/account': 'Account',
  '/subscription-management': 'Subscription Management',
  '/chat': 'Chat',
};


export const usePageTracking = () => {
  const location = useLocation(); // This hook from react-router-dom gives us the current URL

  useEffect(() => {
    // Get a more friendly page name from our mapping, or use the path if not found
    const pageName = pageNameMapping[location.pathname] || location.pathname;

    // Fire the event to Amplitude
    // Instead of a generic name, we create a dynamic one.
    track(`Page Viewed: ${pageName}`, {
      // We can still send the path as a property for consistency
      page_path: location.pathname,
      page_url: window.location.href,
    });

  }, [location]); // This useEffect will re-run every time the `location` changes
};