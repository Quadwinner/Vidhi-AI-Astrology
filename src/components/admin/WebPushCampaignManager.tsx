import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import toast from 'react-hot-toast';

interface CampaignStats {
  totalUsers: number;
  pushEnabledUsers: number;
}

export default function WebPushCampaignManager() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [iconUrl, setIconUrl] = useState('https://your-domain.com/logo192.png');
  const [clickUrl, setClickUrl] = useState('/chat');
  const [segment, setSegment] = useState<'all' | 'push_enabled' | 'test'>('push_enabled');
  const [testEmail, setTestEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoadingStats(true);
    try {
      // Get total users
      const { count: totalUsers } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });

      // Get push-enabled users (would need to check user_notification_preferences table)
      const { count: pushEnabledUsers } = await supabase
        .from('user_notification_preferences')
        .select('*', { count: 'exact', head: true })
        .eq('notification_enabled', true);

      setStats({
        totalUsers: totalUsers || 0,
        pushEnabledUsers: pushEnabledUsers || 0
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleSendCampaign = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error('Please enter title and message');
      return;
    }

    if (segment === 'test' && !testEmail.trim()) {
      toast.error('Please enter test email');
      return;
    }

    setSending(true);

    try {
      // For now, just show success message
      // You'll need to integrate with CleverTap API via Edge Function

      const campaignData = {
        title: title.trim(),
        message: message.trim(),
        iconUrl: iconUrl.trim(),
        clickUrl: clickUrl.trim(),
        segment: segment,
        testEmail: segment === 'test' ? testEmail.trim() : undefined
      };

      console.log('Campaign data:', campaignData);

      // TODO: Call CleverTap API via Edge Function
      // const { data, error } = await supabase.functions.invoke('send-web-push-campaign', {
      //   body: campaignData
      // });

      toast.success('Campaign sent successfully! (Integration pending)');

      // Reset form
      setTitle('');
      setMessage('');
      setClickUrl('/chat');
    } catch (error: any) {
      console.error('Campaign send failed:', error);
      toast.error(error.message || 'Failed to send campaign');
    } finally {
      setSending(false);
    }
  };

  const quickTemplates = [
    {
      name: 'Daily Horoscope',
      title: 'Your Daily Horoscope is Ready! ✨',
      message: 'Discover what the stars have aligned for you today',
      clickUrl: '/chat'
    },
    {
      name: 'Weekly Forecast',
      title: 'Your Weekly Forecast Awaits 🌙',
      message: 'Get insights for the week ahead from your personalized chart',
      clickUrl: '/reports'
    },
    {
      name: 'Re-engagement',
      title: 'We Miss You! 💫',
      message: 'Your personalized astrology insights are waiting. Ask your free question now!',
      clickUrl: '/chat'
    },
    {
      name: 'New Feature',
      title: 'New Feature: Voice Calls with AI Astrologer! 🎙️',
      message: 'Talk to your AI astrologer in real-time. Try it now!',
      clickUrl: '/chat'
    }
  ];

  const applyTemplate = (template: typeof quickTemplates[0]) => {
    setTitle(template.title);
    setMessage(template.message);
    setClickUrl(template.clickUrl);
    toast.success(`Applied template: ${template.name}`);
  };

  return (
    <div style={{ padding: 20, color: '#eaeaea' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ margin: 0, color: '#ffffff' }}>Web Push Campaign Manager</h3>
        <button
          onClick={loadStats}
          disabled={loadingStats}
          style={{
            padding: '8px 16px',
            background: '#2a2a2a',
            color: '#7db2ff',
            border: '1px solid #3a3a3a',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 14
          }}
        >
          {loadingStats ? 'Loading...' : '🔄 Refresh Stats'}
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 15,
          marginBottom: 20
        }}>
          <div style={{
            padding: 15,
            background: '#1f1f1f',
            border: '1px solid #2a2a2a',
            borderRadius: 8
          }}>
            <div style={{ fontSize: 12, color: '#999', marginBottom: 5 }}>Total Users</div>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#7db2ff' }}>{stats.totalUsers}</div>
          </div>
          <div style={{
            padding: 15,
            background: '#1f1f1f',
            border: '1px solid #2a2a2a',
            borderRadius: 8
          }}>
            <div style={{ fontSize: 12, color: '#999', marginBottom: 5 }}>Push-Enabled Users</div>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#4caf50' }}>{stats.pushEnabledUsers}</div>
          </div>
        </div>
      )}

      {/* Info Banner */}
      <div style={{
        background: '#2a4a5a',
        border: '1px solid #3a6a7a',
        borderRadius: 8,
        padding: 15,
        marginBottom: 20,
        color: '#eaeaea'
      }}>
        <strong style={{ color: '#7db2ff' }}>🔔 Note:</strong> Notifications are sent via CleverTap.
        Make sure VAPID keys are configured and users have granted notification permission.
      </div>

      {/* Quick Templates */}
      <div style={{ marginBottom: 20 }}>
        <h4 style={{ marginBottom: 12, color: '#cfcfcf' }}>Quick Templates</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>
          {quickTemplates.map((template) => (
            <button
              key={template.name}
              onClick={() => applyTemplate(template)}
              style={{
                padding: 12,
                background: '#1f1f1f',
                border: '1px solid #2a2a2a',
                borderRadius: 8,
                cursor: 'pointer',
                textAlign: 'left',
                color: '#eaeaea',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#2a2a2a';
                e.currentTarget.style.borderColor = '#3a3a3a';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#1f1f1f';
                e.currentTarget.style.borderColor = '#2a2a2a';
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, color: '#7db2ff' }}>
                {template.name}
              </div>
              <div style={{ fontSize: 12, color: '#999' }}>{template.title}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Campaign Form */}
      <div style={{
        background: '#1f1f1f',
        border: '1px solid #2a2a2a',
        borderRadius: 8,
        padding: 20,
        marginBottom: 20
      }}>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', marginBottom: 8, color: '#cfcfcf', fontWeight: 500 }}>
            Notification Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Your Daily Horoscope is Ready! ✨"
            maxLength={65}
            style={{
              padding: 12,
              borderRadius: 6,
              border: '1px solid #2a2a2a',
              background: '#111',
              color: '#eaeaea',
              width: '100%',
              fontSize: 14
            }}
          />
          <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
            {title.length}/65 characters
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', marginBottom: 8, color: '#cfcfcf', fontWeight: 500 }}>
            Notification Message *
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="e.g., Discover what the stars have aligned for you today"
            maxLength={240}
            rows={3}
            style={{
              padding: 12,
              borderRadius: 6,
              border: '1px solid #2a2a2a',
              background: '#111',
              color: '#eaeaea',
              width: '100%',
              fontSize: 14,
              resize: 'vertical',
              fontFamily: 'inherit'
            }}
          />
          <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
            {message.length}/240 characters
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', marginBottom: 8, color: '#cfcfcf', fontWeight: 500 }}>
            Icon URL (optional)
          </label>
          <input
            type="text"
            value={iconUrl}
            onChange={(e) => setIconUrl(e.target.value)}
            placeholder="https://your-domain.com/logo192.png"
            style={{
              padding: 12,
              borderRadius: 6,
              border: '1px solid #2a2a2a',
              background: '#111',
              color: '#eaeaea',
              width: '100%',
              fontSize: 14
            }}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', marginBottom: 8, color: '#cfcfcf', fontWeight: 500 }}>
            Click Action URL
          </label>
          <input
            type="text"
            value={clickUrl}
            onChange={(e) => setClickUrl(e.target.value)}
            placeholder="/chat"
            style={{
              padding: 12,
              borderRadius: 6,
              border: '1px solid #2a2a2a',
              background: '#111',
              color: '#eaeaea',
              width: '100%',
              fontSize: 14
            }}
          />
          <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
            Where users go when clicking the notification (e.g., /chat, /reports/{'{'}profileId{'}'})
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', marginBottom: 8, color: '#cfcfcf', fontWeight: 500 }}>
            Target Audience
          </label>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button
              onClick={() => setSegment('push_enabled')}
              style={{
                padding: '10px 20px',
                background: segment === 'push_enabled' ? '#117a8b' : '#2a2a2a',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 14
              }}
            >
              Push-Enabled Users ({stats?.pushEnabledUsers || 0})
            </button>
            <button
              onClick={() => setSegment('all')}
              style={{
                padding: '10px 20px',
                background: segment === 'all' ? '#117a8b' : '#2a2a2a',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 14
              }}
            >
              All Users ({stats?.totalUsers || 0})
            </button>
            <button
              onClick={() => setSegment('test')}
              style={{
                padding: '10px 20px',
                background: segment === 'test' ? '#117a8b' : '#2a2a2a',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 14
              }}
            >
              Test (Single User)
            </button>
          </div>

          {segment === 'test' && (
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="user@example.com"
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 6,
                border: '1px solid #2a2a2a',
                background: '#111',
                color: '#eaeaea',
                width: '100%',
                maxWidth: 400,
                fontSize: 14
              }}
            />
          )}
        </div>

        <button
          onClick={handleSendCampaign}
          disabled={sending || !title.trim() || !message.trim()}
          style={{
            padding: '14px 28px',
            background: sending || !title.trim() || !message.trim() ? '#555' : '#117a8b',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            cursor: sending || !title.trim() || !message.trim() ? 'not-allowed' : 'pointer',
            fontSize: 16,
            fontWeight: 'bold',
            transition: 'all 0.2s'
          }}
        >
          {sending ? 'Sending...' : segment === 'test' ? 'Send Test Notification' : 'Send Campaign'}
        </button>
      </div>

      {/* Instructions */}
      <div style={{
        background: '#1f1f1f',
        border: '1px solid #2a2a2a',
        borderRadius: 8,
        padding: 20
      }}>
        <h4 style={{ margin: '0 0 15px 0', color: '#ffffff' }}>📖 How to Use</h4>
        <ol style={{ margin: 0, paddingLeft: 20, color: '#cfcfcf', lineHeight: 1.8 }}>
          <li>Choose a quick template or write your own notification</li>
          <li>Set the title (max 65 chars) and message (max 240 chars)</li>
          <li>Select target audience (push-enabled users recommended)</li>
          <li>Test with a single user first before sending to all</li>
          <li>Click "Send Campaign" to deliver via CleverTap</li>
        </ol>

        <div style={{ marginTop: 15, padding: 12, background: '#2a4a5a', borderRadius: 6 }}>
          <strong style={{ color: '#7db2ff' }}>💡 Best Practices:</strong>
          <ul style={{ margin: '8px 0 0 0', paddingLeft: 20, color: '#eaeaea', fontSize: 13 }}>
            <li>Use emojis sparingly for better engagement</li>
            <li>Keep messages concise and actionable</li>
            <li>Test notifications on different devices before mass send</li>
            <li>Schedule campaigns during active hours (9 AM - 9 PM)</li>
            <li>Avoid sending more than 2 notifications per day</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
