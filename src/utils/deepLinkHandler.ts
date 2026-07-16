import { trackEvent } from './analytics';

interface NotificationClickData {
  url: string;
  notificationData?: Record<string, any>;
  title?: string;
  body?: string;
  timestamp?: string;
}

export function handleNotificationDeepLink(
  payload: NotificationClickData,
  navigate: (path: string) => void
) {
  if (!payload || !payload.url) return;

  try {
    const target = new URL(payload.url, window.location.origin);
    const fullPath = `${target.pathname}${target.search}${target.hash}`;

    trackEvent('Web Push Notification Clicked', {
      url: payload.url,
      pathname: target.pathname,
      search: target.search,
      hash: target.hash,
      title: payload.title,
      body: payload.body,
      timestamp: payload.timestamp,
      campaign_id: payload.notificationData?.wzrk_id,
      deep_link_source: 'clevertap_webpush',
    });

    if (target.pathname.startsWith('/chat')) {
      navigate(fullPath);
      return;
    }

    if (target.pathname.startsWith('/reports')) {
      navigate(fullPath);
      return;
    }

    window.location.assign(target.toString());
  } catch (e) {
    console.error('[DeepLinkHandler] Failed to handle notification deep link:', e);
  }
}



