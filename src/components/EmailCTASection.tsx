// src/components/EmailCTASection.tsx

import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';
import styles from './EmailCTASection.module.css';
import { IconArrowRight } from '@tabler/icons-react';

export default function EmailCTASection() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null); // New state for inline message
  const [isError, setIsError] = useState(false); // New state to style error messages

  const handleSubmit = async (event: React.FormEvent) => { // Made handleSubmit async
    event.preventDefault();

    setFeedbackMessage(null); // Clear previous messages
    setIsError(false); // Reset error state

    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address.');
      // setFeedbackMessage('Please enter a valid email address.'); // Could use this instead of toast for validation
      // setIsError(true);
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('collected_emails')
        .insert({ email: email });

      if (error) {
        // Handle specific error for duplicate email
        if (error.message.includes('duplicate key value violates unique constraint')) {
          setFeedbackMessage('This email has already been subscribed.');
          setIsError(true);
          // You can still show a toast if you want both types of feedback
          toast.error('This email has already been subscribed.');
        } else {
          // Handle other errors
          setFeedbackMessage('Could not subscribe. Please try again.');
          setIsError(true);
          toast.error('Could not subscribe. Please try again.');
          console.error("Supabase error:", error);
        }
      } else {
        // Success
        setEmail('');
        setFeedbackMessage('Thank you for subscribing!');
        setIsError(false);
        toast.success('Thank you for subscribing!'); // Still show success toast
      }
    } catch (err) {
      // Catch any unexpected errors during the async operation
      setFeedbackMessage('An unexpected error occurred. Please try again.');
      setIsError(true);
      toast.error('An unexpected error occurred.');
      console.error("Unexpected error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className={styles.ctaSection}>
      <div className={styles.header}>
        <h2 className={styles.title}>Ready to Transform Your Life?</h2>
        <p className={styles.subtitle}>Join thousands who have discovered their true potential through AstroAura</p>
      </div>

      <form onSubmit={handleSubmit} className={styles.emailForm}>
        {/* Step 1: Wrap the input and button together */}
        <div className={styles.inputWrapper}>
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            className={styles.emailInput}
          />
          <button type="submit" disabled={loading} className={styles.submitButton}>
            {loading ? <div className={styles.loader}></div> : <IconArrowRight size={20} />}
          </button>
        </div>

        {/* Step 2: Create a container that will hold the feedback message */}
        {/* This container will reserve space to prevent layout shift */}
        <div className={styles.feedbackContainer}>
          {feedbackMessage && (
            <p className={`${styles.feedbackMessage} ${isError ? styles.errorMessage : styles.successMessage}`}>
              {feedbackMessage}
            </p>
          )}
        </div>
      </form>

      <p className={styles.footerText}>Start your free consultation today</p>
    </section>
  );
}