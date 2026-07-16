import React, { useEffect } from 'react';

const GoogleTranslateWidget = () => {
  useEffect(() => {
    // This is the function the Google script will call once it's ready.
    const googleTranslateElementInit = () => {
      // We check to ensure the Google Translate object is available.
      if ((window as any).google && (window as any).google.translate) {
        new (window as any).google.translate.TranslateElement({
          pageLanguage: 'en',
          // THE FIX: We remove the 'layout' property.
          // When 'autoDisplay' is false, the widget is hidden by default,
          // so the SIMPLE layout is implicitly used and not needed here.
          // This avoids the race condition that was causing the crash.
          autoDisplay: false,
        }, 'google_translate_element');
      }
    };

    // Add the initialization function to the window object.
    (window as any).googleTranslateElementInit = googleTranslateElementInit;

    // Check if the script is already on the page to prevent duplicates.
    const existingScript = document.querySelector(
      'script[src*="translate.google.com/translate_a/element.js"]'
    );

    if (!existingScript) {
      // If the script isn't there, create it and add it to the page.
      const script = document.createElement('script');
      script.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
      script.async = true;
      document.body.appendChild(script);
    } else {
      // If the script is already on the page, try to initialize the widget.
      googleTranslateElementInit();
    }
  }, []); // The empty dependency array ensures this runs only once.

  // The invisible div where the widget will be rendered.
  return (
    <div id="google_translate_element" style={{ display: 'none' }}></div>
  );
};

export default GoogleTranslateWidget;