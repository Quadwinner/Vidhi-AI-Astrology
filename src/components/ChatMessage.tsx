// src/components/ChatMessage.tsx

import {
  IconArrowRight,
  IconCheck,
  IconChevronDown, // Used for toggles
  IconChevronUp // Used for toggles
  ,
  IconCopy,
  IconHelp,
  IconShare3,
  IconSparkles,
  IconThumbDown,
  IconThumbUp,
  IconX
} from '@tabler/icons-react';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import { ChatMessage as ChatMessageType } from '../pages/ChatPage';
import styles from './ChatMessage.module.css';
import InlineCompatibilityForm from './InlineCompatibilityForm';
import VoiceCallPrompt from './VoiceCallPrompt';

interface ChatMessageProps {
  message: ChatMessageType;
  userLanguage?: string; 
  onFeedback?: (message: ChatMessageType, feedback: 'like' | 'dislike') => void;
  onStartCall?: () => void;
  showVoicePrompt?: boolean;
  onTriggerReasoning?: (text: string) => void;
  onCloseWidget?: (messageId: string) => void;
}

export default function ChatMessage({
  message,
  userLanguage = 'en', 
  onFeedback,
  onStartCall,
  showVoicePrompt = false,
  onTriggerReasoning,
  onCloseWidget
}: ChatMessageProps) {

  // =========================================================
  // 1. HOOKS
  // =========================================================

  // Content State
  const [displayContent, setDisplayContent] = useState('');
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [isPredictionMode, setIsPredictionMode] = useState(false);
  const [isCompatibilityReport, setIsCompatibilityReport] = useState(false);

  // UI State
  const [isCallPromptVisible, setIsCallPromptVisible] = useState(false);
  const [showSampleModal, setShowSampleModal] = useState(false);
  
  // Toggles State
  const [isCopied, setIsCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false); // For "Read more" text
  const [isFollowUpExpanded, setIsFollowUpExpanded] = useState(true); // For "Ask next" questions

  // Helper variables
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const isTypingIndicator = isAssistant && message.content === 'AuraAI is typing...';

  // Determine if message is long enough to collapse (e.g. > 380 chars)
  const isLongMessage = displayContent.length > 380;

  // Effect: Handle Voice Call Prompt visibility
  useEffect(() => {
    if (showVoicePrompt) setIsCallPromptVisible(true);
  }, [showVoicePrompt]);

  // Effect: Parse Content
  useEffect(() => {
    if (!isAssistant || isTypingIndicator || message.isWidget) {
      setDisplayContent(message.content || '');
      return;
    }

    let content = message.content;

    // Check if this is a compatibility report
    const isCompat = content.includes('Ashtakoot') || content.includes('compatibility score');
    setIsCompatibilityReport(isCompat);

    // Normalize malformed tags from reasoning models (missing brackets, truncated names)
    content = content
      .replace(/\[ANSWER\]?\s*/i, '[ANSWER]')
      .replace(/\[\/?\s*ANSWER\s*\]?/gi, (m) => m.includes('/') ? '[/ANSWER]' : '[ANSWER]')
      .replace(/\[FAV_FACTORS?\]?/gi, '[FAV_FACTORS]')
      .replace(/\[\/FAV_FACTORS?\]?/gi, '[/FAV_FACTORS]')
      .replace(/\[CHALLENG(?:ES)?\]?/gi, '[CHALLENGES]')
      .replace(/\[\/CHALLENG(?:ES)?\]?/gi, '[/CHALLENGES]')
      .replace(/\[\/CHENG\]/gi, '[/CHALLENGES]')
      .replace(/\[FOLLOWUP\]?/gi, '[FOLLOWUP]')
      .replace(/\[\/FOLLOWUP\]?/gi, '[/FOLLOWUP]');

    // If [ANSWER] exists but no [/ANSWER], add it before [FAV_FACTORS] or [FOLLOWUP] or at end
    if (content.includes('[ANSWER]') && !content.includes('[/ANSWER]')) {
      const endMarker = content.search(/\[FAV_FACTORS\]|\[FOLLOWUP\]|\[CHALLENGES\]/);
      if (endMarker > 0) {
        content = content.slice(0, endMarker) + '[/ANSWER]' + content.slice(endMarker);
      } else {
        content += '[/ANSWER]';
      }
    }

    // Extract Follow-up Questions
    const followUpMatch = content.match(/\[FOLLOWUP\]([\s\S]*?)\[\/FOLLOWUP\]/);
    if (followUpMatch) {
      setSuggestedQuestions(
        followUpMatch[1].trim().split('\n').map(q => q.replace(/\*\*/g, '').replace(/^\-\s*/, '').trim()).filter(l => l.trim().length > 0)
      );
    }

    // Extract Answer for Formatting
    const answerMatch = content.match(/\[ANSWER\]([\s\S]*?)\[\/ANSWER\]/);
    if (answerMatch) {
      setIsPredictionMode(true);
      let cleanAnswer = answerMatch[1].trim();
      cleanAnswer = cleanAnswer.replace(/→/g, '\n\n→');
      setDisplayContent(cleanAnswer);
    } else {
      setIsPredictionMode(false);
      // Strip any remaining tag-like patterns
      const cleanContent = content
        .replace(/\[\/?(ANSWER|FAV_FACTORS?|CHALLENGES?|CHALLENG|CHENG|FOLLOWUP)\]?/gi, '')
        .trim();
      setDisplayContent(cleanContent || content);
    }
  }, [message, isAssistant, isTypingIndicator]);

  // =========================================================
  // 2. HANDLERS
  // =========================================================

  const handleReasoningClick = () => {
    if (onTriggerReasoning) {
      let prompt = "Tell me the deep astrological reasoning and specific timelines.";
      onTriggerReasoning(prompt);
    }
  };

  const handleFollowUpClick = (question: string) => {
    if (onTriggerReasoning) onTriggerReasoning(question);
  };

  const handleSampleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowSampleModal(true);
  };

  const handleCopy = async () => {
    try {
      if (!displayContent) return;
      await navigator.clipboard.writeText(displayContent);
      setIsCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy');
    }
  };

  const handleShare = async () => {
    if (!displayContent) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Aura AI Insight',
          text: displayContent,
        });
      } catch (err) {
        // User cancelled share
      }
    } else {
      handleCopy();
      toast('Link copied (Sharing unavailable on desktop)', { icon: '🔗' });
    }
  };

  // Toggle Read More / Less
  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  // Toggle Follow Up Questions
  const toggleFollowUp = () => {
    setIsFollowUpExpanded(!isFollowUpExpanded);
  };

  // =========================================================
  // 3. RENDER LOGIC
  // =========================================================

  // A. WIDGET RENDERING
  if (message.isWidget && message.widgetType === 'compatibility_form') {
    return (
      <div className={`${styles.messageRow} ${styles.assistantRow}`}>
        <div className={styles.messageWrapper} style={{ maxWidth: '500px', width: '100%' }}>
          <div className={styles.assistantBubble}>
            <InlineCompatibilityForm
              initialName={message.widgetData?.partner_name}
              initialDob={message.widgetData?.partner_dob}
              initialTob={message.widgetData?.partner_tob}
              initialGender={message.widgetData?.partner_gender}
              subCategory={message.widgetData?.sub_category}
              initialPlace={message.widgetData?.birth_place}
              initialLat={message.widgetData?.birth_lat}
              initialLng={message.widgetData?.birth_lng}
              initialTimezone={message.widgetData?.birth_timezone}
              isLocked={message.widgetData?.isLocked}
              needsPayment={message.widgetData?.needsPayment} 
              language={userLanguage} 
              onClose={() => onCloseWidget && message.id && onCloseWidget(message.id)}
              onSubmit={(data) => message.onWidgetSubmit && message.onWidgetSubmit({
                ...message.widgetData, 
                ...data,             
                messageId: message.id
              })}
              isLoading={false}
            />
          </div>
        </div>
      </div>
    );
  }

  // B. STANDARD TEXT MESSAGE RENDERING
  return (
    <div className={`${styles.messageRow} ${isUser ? styles.userRow : styles.assistantRow}`}>
      <div className={styles.messageWrapper}>
        <div className={`${styles.bubble} ${isUser ? styles.userBubble : styles.assistantBubble}`}>
          {isTypingIndicator ? (
            <div className={styles.typingIndicator}>
              <span>AuraAI is typing</span>
              <span className={styles.dots}><span>.</span><span>.</span><span>.</span></span>
            </div>
          ) : (
            <>
              {/* --- MARKDOWN CONTENT WITH READ MORE LOGIC --- */}
              <div 
                className={`${styles.markdownContainer} ${isLongMessage && !isExpanded ? styles.collapsed : styles.expanded}`}
              >
                <ReactMarkdown>{displayContent}</ReactMarkdown>
              </div>

              {/* READ MORE BUTTON */}
              {isLongMessage && (
                <button 
                  onClick={toggleExpand} 
                  className={styles.readMoreBtn}
                >
                  {isExpanded ? (
                    <>Read less <IconChevronUp size={14} /></>
                  ) : (
                    <>Read more <IconChevronDown size={14} /></>
                  )}
                </button>
              )}

              {/* REASONING UI */}
              {isPredictionMode && (
                <div
                  className={styles.factorsContainer}
                  onClick={handleReasoningClick}
                  role="button"
                  tabIndex={0}
                >
                  <div className={styles.factorsContent}>
                    <div className={styles.factorsIcon}>
                      <IconSparkles size={18} className={styles.sparkleIcon} />
                    </div>
                    <div className={styles.factorsText}>
                      <span className={styles.factorsTitle}>Unlock Deep Insights & Reasoning</span>
                      <span className={styles.factorsSub}>Tap to see timelines & planetary logic</span>
                    </div>
                  </div>

                  <div className={styles.factorsRight}>
                    <button className={styles.sampleLink} onClick={handleSampleClick}>
                      <IconHelp size={14} style={{ marginRight: 4 }} /> Preview
                    </button>
                    <IconArrowRight size={18} className={styles.arrowIcon} />
                  </div>
                </div>
              )}

              {/* --- COLLAPSIBLE FOLLOW-UP QUESTIONS --- */}
              {!isTypingIndicator && suggestedQuestions.length > 0 && (
                <div className={styles.followUpContainer}>
                  
                  {/* Collapsible Header */}
                  <button 
                    className={styles.followUpHeader} 
                    onClick={toggleFollowUp}
                    title={isFollowUpExpanded ? "Collapse suggestions" : "Show suggestions"}
                  >
                    <span className={styles.followUpLabel}>Ask next:</span>
                    {isFollowUpExpanded ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
                  </button>

                  {/* List with CSS transition classes */}
                  <div className={`${styles.followUpList} ${isFollowUpExpanded ? styles.followUpExpanded : styles.followUpCollapsed}`}>
                    {suggestedQuestions.map((q, idx) => (
                      <button
                        key={idx}
                        className={styles.followUpChip}
                        onClick={() => handleFollowUpClick(q)}
                      >
                        {q} <IconArrowRight size={12} />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* SAMPLE MODAL */}
        {showSampleModal && (
          <div className={styles.modalOverlay} onClick={() => setShowSampleModal(false)}>
            <div className={styles.sampleModal} onClick={e => e.stopPropagation()}>
              <div className={styles.sampleHeader}>
                <h3>Why Check the Reasoning?</h3>
                <button onClick={() => setShowSampleModal(false)}><IconX size={18} /></button>
              </div>
              <div className={styles.sampleContent}>
                <p className={styles.modalIntro}>You received the prediction. Now see the <strong>science</strong> behind it.</p>
                <div className={styles.modalFeature}>
                  <span className={styles.featureIcon}>📅</span>
                  <div>
                    <strong>Exact Timelines</strong>
                    <p>See exactly which months (e.g., "March to July") are your golden window.</p>
                  </div>
                </div>
                <div className={styles.modalFeature}>
                  <span className={styles.featureIcon}>🪐</span>
                  <div>
                    <strong>Planetary Logic</strong>
                    <p>Understand how Saturn, Jupiter, or your Dasha Lord is triggering this event.</p>
                  </div>
                </div>
                <button className={styles.modalCta} onClick={() => { setShowSampleModal(false); handleReasoningClick(); }}>
                  Reveal My Chart's Logic
                </button>
              </div>
            </div>
          </div>
        )}

        <div className='oneline'>
          {isAssistant && !isTypingIndicator && (
            <div className={styles.controls}>
              
              {/* 1. FEEDBACK GROUP */}
              {onFeedback && (
                <div className={styles.feedbackContainer}>
                  <button 
                    className={`${styles.feedbackButton} ${message.feedback === 'like' ? styles.selected : ''}`} 
                    onClick={() => onFeedback(message, 'like')} 
                    disabled={!!message.feedback}
                    title="Helpful"
                  >
                    <IconThumbUp size={16} />
                  </button>
                  <button 
                    className={`${styles.feedbackButton} ${message.feedback === 'dislike' ? styles.selected : ''}`} 
                    onClick={() => onFeedback(message, 'dislike')} 
                    disabled={!!message.feedback}
                    title="Not Helpful"
                  >
                    <IconThumbDown size={16} />
                  </button>
                </div>
              )}

              {/* 2. SHARE GROUP */}
              <div className={styles.shareContainer}>
                 <button 
                   className={styles.feedbackButton} 
                   onClick={handleCopy} 
                   title="Copy response"
                 >
                   {isCopied ? <IconCheck size={16} color="#4ade80" /> : <IconCopy size={16} />}
                 </button>
                 <button 
                   className={styles.feedbackButton} 
                   onClick={handleShare} 
                   title="Share / Forward"
                 >
                   <IconShare3 size={16} />
                 </button>
              </div>

            </div>
          )}

          {isAssistant && !isTypingIndicator && isCallPromptVisible && onStartCall && (
            <div style={{ marginTop: 8 }}>
              <VoiceCallPrompt onStartCall={() => { onStartCall(); setIsCallPromptVisible(false); }} onClose={() => setIsCallPromptVisible(false)} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}