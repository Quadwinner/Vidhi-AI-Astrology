// src/components/CallFeedback.tsx
import React, { useState } from "react";
import styles from "./CallFeedback.module.css";

interface CallFeedbackProps {
  profileName: string;
  onSubmit: (rating: number, comments: string) => void;
  onClose: () => void;
}

const CallFeedback: React.FC<CallFeedbackProps> = ({
  profileName,
  onSubmit,
  onClose,
}) => {
  const [rating, setRating] = useState(0);
  const [comments, setComments] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const emojis = [
    { id: 1, emoji: "😡", label: "Terrible" },
    { id: 2, emoji: "😕", label: "Poor" },
    { id: 3, emoji: "😐", label: "Okay" },
    { id: 4, emoji: "😊", label: "Good" },
    { id: 5, emoji: "🤩", label: "Amazing" },
  ];

  const handleSubmit = async () => {
    if (rating === 0) return;
    setIsSubmitting(true);
    await onSubmit(rating, comments);
    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <button className={styles.closeButton} onClick={onClose}>
          ×
        </button>

        <h3 className={styles.title}>
          How was your experience with Vidhi AI?
        </h3>
        <p className={styles.subtitle}>
          Click on an emoji to rate your experience
        </p>

        <div className={styles.emojiRow}>
          {emojis.map((e) => (
            <div
              key={e.id}
              className={`${styles.emojiCard} ${
                rating === e.id ? styles.activeEmoji : ""
              }`}
              onClick={() => setRating(e.id)}
            >
              <span className={styles.emoji}>{e.emoji}</span>
              <p className={styles.emojiLabel}>{e.label}</p>
            </div>
          ))}
        </div>

        <h4 className={styles.feedbackLabel}>
          Tell us more about your experience
        </h4>
        <textarea
          className={styles.commentsTextarea}
          placeholder="Share your thoughts about the accuracy, helpfulness, and overall experience with Vidhi AI..."
          maxLength={500}
          value={comments}
          onChange={(e) => setComments(e.target.value)}
        />
        <p className={styles.charCount}>{comments.length}/500</p>

        <button
          className={styles.submitButton}
          onClick={handleSubmit}
          disabled={rating === 0 || isSubmitting}
        >
          {isSubmitting ? "Submitting..." : "Submit Feedback"}
        </button>
      </div>
    </div>
  );
};

export default CallFeedback;
