// File: src/hooks/useLoadScript.ts

import { useState, useEffect } from 'react';

// This hook takes a script URL and loads it into the document head.
// It returns 'true' when the script has loaded successfully.
export const useLoadScript = (src: string): boolean => {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Check if a script with this src already exists to avoid duplicates
    if (document.querySelector(`script[src="${src}"]`)) {
      setLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;

    const onScriptLoad = () => {
      setLoaded(true);
    };

    const onScriptError = () => {
      console.error(`Error loading script: ${src}`);
      setLoaded(false);
    };

    script.addEventListener('load', onScriptLoad);
    script.addEventListener('error', onScriptError);

    document.body.appendChild(script);

    // Clean up the event listeners when the component unmounts
    return () => {
      script.removeEventListener('load', onScriptLoad);
      script.removeEventListener('error', onScriptError);
    };
  }, [src]); // Only re-run if the src changes

  return loaded;
};