// src/components/CategoryCard.tsx

import { IconChevronDown, IconHeartbeat, IconSparkles } from "@tabler/icons-react";
import React, { useEffect, useState } from "react";
import styles from "./CategoryCard.module.css";

// --- Asset imports ---
import Career from "../assets/Career.png";
import Love from "../assets/Love.png";
import Money from "../assets/Money.png";
import Spiritual from "../assets/Spiritual.png";

interface Category {
  name: string;
  questions: string[];
}

interface CategoryCardProps {
  categories: Category[];
  onQuestionSelect: (question: string) => void;
  onVisibilityChange?: (isVisible: boolean) => void;
}

const categoryIcons: Record<string, { icon: any; style: React.CSSProperties }> = {
  Love: { icon: Love, style: { borderRadius: "9999px", border: "1px solid rgba(248, 113, 113, 0.30)", background: " rgba(239, 68, 68, 0.20)" } },
  Career: { icon: Career, style: { borderRadius: "9999px", border: "1px solid rgba(74, 222, 128, 0.30)", background: "rgba(34, 197, 94, 0.20)" } },
  Health: {
    icon: IconHeartbeat,
    style: {
      borderRadius: "9999px",
      border: "1px solid rgba(244, 114, 182, 0.30)",
      background: "rgba(236, 72, 153, 0.20)"
    },
  },
  Money: { icon: Money, style: { borderRadius: "9999px", border: "1px solid rgba(96, 165, 250, 0.30)", background: " rgba(59, 130, 246, 0.20)" } },
  Spiritual: { icon: Spiritual, style: { borderRadius: "9999px", border: "1px solid rgba(251, 146, 60, 0.30)", background: " rgba(249, 115, 22, 0.20)" } },
};

// Fallback icon for any category name not explicitly mapped above, so
// personalized categories with different names still render a chip.
const DEFAULT_CATEGORY_ICON = {
  icon: IconSparkles,
  style: {
    borderRadius: "9999px",
    border: "1px solid rgba(229, 180, 91, 0.35)",
    background: "rgba(229, 180, 91, 0.18)",
  } as React.CSSProperties,
};

export default function CategoryCard({
  categories,
  onQuestionSelect,
  onVisibilityChange,
}: CategoryCardProps) {
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [isClosing, setIsClosing] = useState(false);

  // Notify parent component about visibility (including during animation)
  useEffect(() => {
    onVisibilityChange?.(Boolean(activeCategory) || isClosing);
  }, [activeCategory, isClosing, onVisibilityChange]);

  const handleCategoryClick = (cat: Category) => {
    if (activeCategory?.name === cat.name) {
      // If clicking the same category, toggle close
      triggerClose();
    } else {
      // If clicking a different category, switch immediately
      setActiveCategory(cat);
      setIsClosing(false);
    }
  };

  const triggerClose = () => {
    setIsClosing(true);
    // Wait for the CSS animation (350ms) to finish before removing data
    setTimeout(() => {
      setActiveCategory(null);
      setIsClosing(false);
    }, 350); 
  };

  // Render if we have active data OR if we are currently animating out
  const showPanel = activeCategory !== null || isClosing;
  
  // Safe fallback to keep content visible during the closing animation
  const displayCategory = activeCategory;

  return (
    <div className={styles.wrapper}>
      {/* 1. Category Icons Row */}
      <div className={styles.categoryRow}>
        {categories
          .filter(cat => cat && cat.name && Array.isArray(cat.questions) && cat.questions.length > 0)
          .map((cat) => {
            const data = categoryIcons[cat.name] || DEFAULT_CATEGORY_ICON;
            const isActive = activeCategory?.name === cat.name;
            const IconComponent = data.icon;

            return (
              <button
                key={cat.name}
                className={`${styles.categoryButton} ${isActive ? styles.active : ""}`}
                onClick={() => handleCategoryClick(cat)}
              >
                <div className={styles.icon} style={data?.style}>
                  {typeof IconComponent === 'string' ? (
                    <img src={IconComponent} alt={cat.name} className={styles.categoryIcon} />
                  ) : (
                    <IconComponent size={16} className={styles.categoryIconSvg} />
                  )}
                </div>
                <span>{cat.name}</span>
                <svg
                  className={`${styles.dropdownArrow} ${isActive ? styles.arrowOpen : ''}`}
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                >
                  <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            );
          })}
      </div>

      {/* 2. Collapsible Questions Panel */}
      {showPanel && displayCategory && (
        <div className={`${styles.questionsPanel} ${isClosing ? styles.panelClosing : ''}`}>
          
          {/* Header with Title and Close Button */}
          <div className={styles.panelHeader}>
             <span className={styles.panelTitle}>Suggested Questions</span>
             <button 
               className={styles.closePanelButton} 
               onClick={triggerClose}
               title="Collapse suggestions"
             >
               <IconChevronDown size={18} />
             </button>
          </div>

          <div className={styles.questionsList} key={displayCategory.name}>
            {displayCategory.questions?.length > 0 ? (
              displayCategory.questions.map((q, index) => (
                <button
                  key={index}
                  className={styles.questionButton}
                  onClick={() => onQuestionSelect(q)}
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <span className={styles.questionCircle}></span>
                  <span className={styles.questionText}>{q}</span>
                </button>
              ))
            ) : (
              <div className={styles.noQuestions}>No questions available.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}