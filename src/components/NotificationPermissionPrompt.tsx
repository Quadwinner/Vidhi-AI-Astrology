// NotificationPermissionPrompt Component
// Handles permission request UI with banner and modal variants

import React, { useState } from 'react';
import styled from 'styled-components';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { trackEvent } from '../utils/analytics';
import toast from 'react-hot-toast';

// @ts-ignore - CleverTap types not available
declare const clevertap: any;

interface NotificationPermissionPromptProps {
  trigger: 'chat' | 'profile' | 'subscription' | 'manual';
  onClose: () => void;
  variant?: 'modal' | 'banner';
}

const NotificationPermissionPrompt: React.FC<NotificationPermissionPromptProps> = ({
  trigger,
  onClose,
  variant = 'banner',
}) => {
  const { user } = useAuth();
  const [isRequesting, setIsRequesting] = useState(false);

  // Messaging based on trigger context
  const getMessaging = () => {
    switch (trigger) {
      case 'chat':
        return {
          title: '🌟 Get Daily Cosmic Insights',
          body: 'Receive personalized horoscope updates and auspicious timing alerts.',
          cta: 'Enable Notifications',
        };
      case 'profile':
        return {
          title: '🔔 Never Miss Planetary Transits',
          body: 'Get notified when important astrological events affect your chart.',
          cta: 'Turn On Alerts',
        };
      case 'subscription':
        return {
          title: '✨ Premium Alerts Enabled',
          body: 'Get weekly forecast reminders and exclusive insights delivered.',
          cta: 'Enable Push Notifications',
        };
      default:
        return {
          title: '🌙 Stay Connected to the Cosmos',
          body: 'Receive timely astrology insights and updates.',
          cta: 'Enable Notifications',
        };
    }
  };

  const handleEnableNotifications = async () => {
    setIsRequesting(true);
    trackEvent('Notification Permission Requested', { trigger });

    try {
      // Check browser support
      if (!('Notification' in window)) {
        throw new Error('Browser does not support notifications');
      }

      // Check current permission status
      if (Notification.permission === 'denied') {
        throw new Error('Notification permission was previously denied. Please enable it in your browser settings.');
      }

      // Use native browser Notification API (more reliable than CleverTap's custom prompt)
      const result = await Notification.requestPermission();

      if (result === 'granted') {
        trackEvent('Notification Permission Granted', { trigger });

        // Register service worker for push notifications if CleverTap is available
        try {
          if ('serviceWorker' in navigator && typeof clevertap !== 'undefined') {
            // Register CleverTap service worker
            const registration = await navigator.serviceWorker.register('/clevertap_sw.js', {
              scope: '/'
            });
            console.log('[Notification Prompt] Service worker registered:', registration);

            // CRITICAL: Request push subscription from CleverTap
            // This registers the push token with CleverTap's servers
            if (clevertap.notifications && clevertap.notifications.push) {
              try {
                await clevertap.notifications.push({
                  titleText: 'Welcome!',
                  bodyText: 'You will now receive cosmic insights and updates.',
                  okButtonText: 'OK',
                  rejectButtonText: 'Cancel',
                  okButtonColor: '#9333EA',
                  skipDialog: true, // Skip the dialog since permission is already granted
                  serviceWorkerPath: '/clevertap_sw.js',
                  vapidPublicKey: 'BBP6tWBZCnyNnN39wXWHaKJP_K2WbDM4034HIr2Md_aTb36mqkkldoFP_rxh55v-_G1rIxSZE0Q6rEMXIT5pVuo'
                });
                console.log('[Notification Prompt] ✅ Push token registered with CleverTap');
              } catch (pushError) {
                console.error('[Notification Prompt] ⚠️ Failed to register push token:', pushError);
              }
            }

            // Update CleverTap profile
            if (clevertap.profile) {
              clevertap.profile.push({
                Site: {
                  push_enabled: true,
                  push_grant_date: new Date().toISOString(),
                  push_trigger_source: trigger,
                },
              });
            }
          }
        } catch (swError) {
          console.warn('[Notification Prompt] Service worker registration failed:', swError);
          // Don't fail - permission is granted, SW can be registered later
        }

        // Store preference in Supabase
        try {
          await supabase
            .from('user_notification_preferences')
            .upsert({
              user_id: user?.id,
              notification_permission: 'granted',
              notification_enabled: true,
              updated_at: new Date().toISOString(),
            });
        } catch (dbError) {
          console.warn('[Notification Prompt] Failed to save preference to DB:', dbError);
          // Don't fail the flow if DB save fails
        }

        toast.success('Notifications enabled! You\'ll receive updates soon.');
        onClose();
      } else {
        trackEvent('Notification Permission Denied', { trigger });

        // Store denial to avoid re-prompting (30-day cooldown)
        localStorage.setItem('ct_push_permission_denied', Date.now().toString());

        try {
          await supabase
            .from('user_notification_preferences')
            .upsert({
              user_id: user?.id,
              notification_permission: 'denied',
              notification_enabled: false,
              updated_at: new Date().toISOString(),
            });
        } catch (dbError) {
          console.warn('[Notification Prompt] Failed to save denial to DB:', dbError);
        }

        toast('You can enable notifications later in Account Settings.', {
          icon: 'ℹ️',
        });
        onClose();
      }
    } catch (error: any) {
      console.error('[Notification Prompt] Error requesting permission:', error);
      trackEvent('Notification Permission Error', {
        trigger,
        error: error.message,
      });

      // Provide specific error messages
      let errorMessage = 'Failed to enable notifications.';

      if (error.message?.includes('denied')) {
        errorMessage = 'Notifications were blocked. Please enable them in your browser settings.';
      } else if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        errorMessage = 'Notifications require a secure connection (HTTPS).';
      } else if (!('Notification' in window)) {
        errorMessage = 'Your browser does not support notifications.';
      }

      toast.error(errorMessage, { duration: 5000 });
      onClose();
    } finally {
      setIsRequesting(false);
    }
  };

  const handleDismiss = () => {
    trackEvent('Notification Prompt Dismissed', { trigger });
    localStorage.setItem('ct_push_prompt_dismissed', Date.now().toString());
    onClose();
  };

  const messaging = getMessaging();

  if (variant === 'modal') {
    return (
      <ModalOverlay onClick={handleDismiss}>
        <ModalContent onClick={(e) => e.stopPropagation()}>
          <ModalHeader>
            <ModalTitle>{messaging.title}</ModalTitle>
            <CloseButton onClick={handleDismiss}>&times;</CloseButton>
          </ModalHeader>
          <ModalBody>{messaging.body}</ModalBody>
          <ModalFooter>
            <SecondaryButton onClick={handleDismiss}>Maybe Later</SecondaryButton>
            <PrimaryButton onClick={handleEnableNotifications} disabled={isRequesting}>
              {isRequesting ? 'Requesting...' : messaging.cta}
            </PrimaryButton>
          </ModalFooter>
        </ModalContent>
      </ModalOverlay>
    );
  }

  // Banner variant
  return (
    <BannerContainer>
      <BannerIcon>🔔</BannerIcon>
      <BannerContent>
        <BannerTitle>{messaging.title}</BannerTitle>
        <BannerBody>{messaging.body}</BannerBody>
      </BannerContent>
      <BannerActions>
        <TextButton onClick={handleDismiss}>Not Now</TextButton>
        <PrimaryButton onClick={handleEnableNotifications} disabled={isRequesting}>
          {isRequesting ? '...' : messaging.cta}
        </PrimaryButton>
      </BannerActions>
    </BannerContainer>
  );
};

export default NotificationPermissionPrompt;

// Styled Components

// Modal styles
const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 1rem;
`;

const ModalContent = styled.div`
  background: white;
  border-radius: 16px;
  max-width: 480px;
  width: 100%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
`;

const ModalHeader = styled.div`
  padding: 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #e5e7eb;
`;

const ModalTitle = styled.h3`
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #111827;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  font-size: 2rem;
  color: #9ca3af;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;

  &:hover {
    color: #4b5563;
  }
`;

const ModalBody = styled.div`
  padding: 1.5rem;
  color: #4b5563;
  line-height: 1.6;
`;

const ModalFooter = styled.div`
  padding: 1.5rem;
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  border-top: 1px solid #e5e7eb;
`;

// Banner styles
const BannerContainer = styled.div`
  position: fixed;
  top: 80px;
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(135deg, rgba(168, 85, 247, 0.95) 0%, rgba(147, 51, 234, 0.95) 100%);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1) inset;
  padding: 1.25rem 1.5rem;
  display: flex;
  align-items: center;
  gap: 1.25rem;
  max-width: 650px;
  width: calc(100% - 2rem);
  z-index: 99999;
  animation: slideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1);

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(-30px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }

  @media (max-width: 768px) {
    top: 70px;
    flex-direction: column;
    text-align: center;
    padding: 1rem;
  }
`;

const BannerIcon = styled.div`
  font-size: 2.5rem;
  flex-shrink: 0;
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.2));

  @media (max-width: 768px) {
    font-size: 2rem;
  }
`;

const BannerContent = styled.div`
  flex: 1;
`;

const BannerTitle = styled.div`
  font-weight: 600;
  color: #ffffff;
  font-size: 1.05rem;
  margin-bottom: 0.35rem;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);

  @media (max-width: 768px) {
    font-size: 1rem;
  }
`;

const BannerBody = styled.div`
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.9);
  line-height: 1.5;

  @media (max-width: 768px) {
    font-size: 0.8125rem;
  }
`;

const BannerActions = styled.div`
  display: flex;
  gap: 0.75rem;
  align-items: center;

  @media (max-width: 768px) {
    width: 100%;
    justify-content: center;
  }
`;

// Button styles
const PrimaryButton = styled.button`
  background: #ffffff;
  color: #9333EA;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 10px;
  font-weight: 600;
  cursor: pointer;
  font-size: 0.875rem;
  white-space: nowrap;
  transition: all 0.2s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);

  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
    background: #fefefe;
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  @media (max-width: 768px) {
    padding: 0.625rem 1.25rem;
    font-size: 0.8125rem;
  }
`;

const SecondaryButton = styled.button`
  background: rgba(255, 255, 255, 0.15);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 0.625rem 1.25rem;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
  backdrop-filter: blur(4px);

  &:hover {
    background: rgba(255, 255, 255, 0.25);
    border-color: rgba(255, 255, 255, 0.3);
  }
`;

const TextButton = styled.button`
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.875rem;
  cursor: pointer;
  padding: 0.5rem 0.75rem;
  font-weight: 500;
  transition: all 0.2s;
  border-radius: 6px;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
  }

  @media (max-width: 768px) {
    font-size: 0.8125rem;
  }
`;
