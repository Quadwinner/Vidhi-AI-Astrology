import React, { useState } from 'react';
import { supabase } from '../supabaseClient'; // 1. Import Supabase client
import toast from 'react-hot-toast'; // 2. Import react-hot-toast for notifications
import styles from './FooterEmailBanner.module.css';

export default function FooterEmailBanner() {
  // 3. Add all necessary state variables from the functional component
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  // 4. Replace the placeholder 'submit' function with the robust 'handleSubmit' logic
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFeedbackMessage(null);
    setIsError(false);

    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address.');
      setFeedbackMessage('Please enter a valid email address.');
      setIsError(true);
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('collected_emails')
        .insert({ email: email });

      if (error) {
        if (error.message.includes('duplicate key value')) {
          setFeedbackMessage('This email has already been subscribed.');
          setIsError(true);
          toast.error('This email has already been subscribed.');
        } else {
          setFeedbackMessage('Could not subscribe. Please try again.');
          setIsError(true);
          toast.error('Could not subscribe. Please try again.');
          console.error("Supabase error:", error);
        }
      } else {
        setEmail('');
        setFeedbackMessage('Thank you for subscribing!');
        setIsError(false);
        toast.success('Thank you for subscribing!');
      }
    } catch (err) {
      setFeedbackMessage('An unexpected error occurred. Please try again.');
      setIsError(true);
      toast.error('An unexpected error occurred.');
      console.error("Unexpected error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className={styles.wrapper} aria-label="email-cta-banner">
      <div className={styles.inner}>
        <h3 className={styles.title}>Ready to Transform Your Life?</h3>
        <p className={styles.subtitle}>Join thousands who have discovered their true potential through Vidhi</p>

        {/* 5. Update form to use the new handler and add the feedback container */}
        <form className={styles.formRow} onSubmit={handleSubmit}>
          <input
            type="email"
            className={styles.input}
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading} // Disable input while loading
            aria-label="email"
          />
          <button type="submit" className={styles.button} disabled={loading}>
            {/* Change button text based on loading state */}
            {loading ? 'Subscribing...' : 'Get Started'}
          </button>
        </form>

        {/* 6. Add the inline feedback message container, styled with the new CSS */}
        <div className={styles.feedbackContainer}>
          {feedbackMessage && (
            <p className={`${styles.feedbackMessage} ${isError ? styles.errorMessage : styles.successMessage}`}>
              {feedbackMessage}
            </p>
          )}
        </div>

        <div className={styles.note}>Start your free consultation today</div>
      </div>
    </section>
  );
}