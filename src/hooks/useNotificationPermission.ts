// useNotificationPermission Hook
// Manages notification permission state and prompt logic

import { useState, useEffect } from 'react';

export type PermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

interface UseNotificationPermissionReturn {
  permission: PermissionState;
  isSupported: boolean;
  shouldShowPrompt: (trigger: string) => boolean;
  markPromptShown: (trigger: string) => void;
  resetPromptState: () => void;
}

export const useNotificationPermission = (): UseNotificationPermissionReturn => {
  const [permission, setPermission] = useState<PermissionState>('default');
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    // Check browser support
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      console.warn('[Notification Permission] Browser does not support notifications');
      setIsSupported(false);
      setPermission('unsupported');
      return;
    }

    setIsSupported(true);
    setPermission(Notification.permission as PermissionState);

    // Safari doesn't support permission change events, so we poll
    // This helps detect when user changes permission in browser settings
    const interval = setInterval(() => {
      if (Notification.permission !== permission) {
        console.log('[Notification Permission] Permission changed to:', Notification.permission);
        setPermission(Notification.permission as PermissionState);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [permission]);

  const shouldShowPrompt = (trigger: string): boolean => {
    // Don't show if unsupported
    if (!isSupported) {
      console.log('[Notification Permission] Skipping prompt: unsupported');
      return false;
    }

    // Don't show if already granted
    if (permission === 'granted') {
      console.log('[Notification Permission] Skipping prompt: already granted');
      return false;
    }

    // Don't show if permission denied
    if (permission === 'denied') {
      console.log('[Notification Permission] Skipping prompt: permission denied');
      return false;
    }

    // Check if denied via CleverTap custom prompt (user clicked "No Thanks")
    const deniedTimestamp = localStorage.getItem('ct_push_permission_denied');
    if (deniedTimestamp) {
      const daysSinceDenial = (Date.now() - parseInt(deniedTimestamp)) / (1000 * 60 * 60 * 24);
      // Don't ask again for 30 days after denial
      if (daysSinceDenial < 30) {
        console.log('[Notification Permission] Skipping prompt: denied recently (30-day cooldown)');
        return false;
      } else {
        // Cooldown expired, clear the flag
        localStorage.removeItem('ct_push_permission_denied');
      }
    }

    // Check if dismissed recently
    const dismissedTimestamp = localStorage.getItem('ct_push_prompt_dismissed');
    if (dismissedTimestamp) {
      const hoursSinceDismiss = (Date.now() - parseInt(dismissedTimestamp)) / (1000 * 60 * 60);
      // Wait 24 hours before showing again after dismiss
      if (hoursSinceDismiss < 24) {
        console.log('[Notification Permission] Skipping prompt: dismissed recently (24-hour cooldown)');
        return false;
      } else {
        // Cooldown expired, clear the flag
        localStorage.removeItem('ct_push_prompt_dismissed');
      }
    }

    // Check if already shown for this trigger in this session
    const sessionKey = `ct_push_prompt_shown_${trigger}`;
    if (sessionStorage.getItem(sessionKey)) {
      console.log(`[Notification Permission] Skipping prompt: already shown for trigger "${trigger}" this session`);
      return false;
    }

    // Check if user has interacted with prompt too many times overall
    const totalPrompts = parseInt(localStorage.getItem('ct_push_total_prompts') || '0');
    if (totalPrompts >= 5) {
      console.log('[Notification Permission] Skipping prompt: shown too many times (max 5)');
      return false;
    }

    console.log(`[Notification Permission] Showing prompt for trigger "${trigger}"`);
    return true;
  };

  const markPromptShown = (trigger: string): void => {
    // Mark as shown for this trigger in this session
    sessionStorage.setItem(`ct_push_prompt_shown_${trigger}`, 'true');

    // Increment total prompts counter
    const totalPrompts = parseInt(localStorage.getItem('ct_push_total_prompts') || '0');
    localStorage.setItem('ct_push_total_prompts', String(totalPrompts + 1));

    console.log(`[Notification Permission] Marked prompt as shown for trigger "${trigger}"`);
  };

  const resetPromptState = (): void => {
    // Clear all prompt-related flags (useful for testing or user-requested reset)
    localStorage.removeItem('ct_push_permission_denied');
    localStorage.removeItem('ct_push_prompt_dismissed');
    localStorage.removeItem('ct_push_total_prompts');
    sessionStorage.clear();

    console.log('[Notification Permission] Prompt state reset');
  };

  return {
    permission,
    isSupported,
    shouldShowPrompt,
    markPromptShown,
    resetPromptState,
  };
};
