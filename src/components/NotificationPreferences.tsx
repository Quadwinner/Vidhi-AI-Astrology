import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';

type PermissionValue = 'default' | 'granted' | 'denied' | null;

interface PreferencesState {
  notification_permission: PermissionValue;
  notification_enabled: boolean;
  daily_horoscope_enabled: boolean;
  weekly_forecast_enabled: boolean;
  transit_alerts_enabled: boolean;
  chat_reminders_enabled: boolean;
  subscription_reminders_enabled: boolean;
  promotional_enabled: boolean;
  daily_horoscope_time: string;
  weekly_forecast_day: number;
}

const defaultState: PreferencesState = {
  notification_permission: null,
  notification_enabled: false,
  daily_horoscope_enabled: true,
  weekly_forecast_enabled: true,
  transit_alerts_enabled: true,
  chat_reminders_enabled: false,
  subscription_reminders_enabled: true,
  promotional_enabled: false,
  daily_horoscope_time: '09:00:00',
  weekly_forecast_day: 1,
};

const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const NotificationPreferences: React.FC = () => {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<PreferencesState>(defaultState);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const fetchPrefs = async () => {
      if (!user) return;
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase
          .from('user_notification_preferences')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') throw error;

        if (data) {
          setPrefs({
            notification_permission: (data.notification_permission as PermissionValue) ?? defaultState.notification_permission,
            notification_enabled: data.notification_enabled ?? defaultState.notification_enabled,
            daily_horoscope_enabled: data.daily_horoscope_enabled ?? defaultState.daily_horoscope_enabled,
            weekly_forecast_enabled: data.weekly_forecast_enabled ?? defaultState.weekly_forecast_enabled,
            transit_alerts_enabled: data.transit_alerts_enabled ?? defaultState.transit_alerts_enabled,
            chat_reminders_enabled: data.chat_reminders_enabled ?? defaultState.chat_reminders_enabled,
            subscription_reminders_enabled: data.subscription_reminders_enabled ?? defaultState.subscription_reminders_enabled,
            promotional_enabled: data.promotional_enabled ?? defaultState.promotional_enabled,
            daily_horoscope_time: data.daily_horoscope_time || defaultState.daily_horoscope_time,
            weekly_forecast_day: data.weekly_forecast_day ?? defaultState.weekly_forecast_day,
          });
        } else {
          setPrefs(defaultState);
        }
      } catch (e: any) {
        setError(e.message || 'Failed to load notification preferences');
      } finally {
        setLoading(false);
      }
    };

    fetchPrefs();
  }, [user?.id]);

  const handleToggle = (key: keyof PreferencesState) => {
    setPrefs(prev => ({
      ...prev,
      [key]: typeof prev[key] === 'boolean' ? !prev[key] : prev[key],
    }));
  };

  const handleTimeChange = (value: string) => {
    setPrefs(prev => ({ ...prev, daily_horoscope_time: value }));
  };

  const handleDayChange = (value: string) => {
    const idx = parseInt(value, 10);
    setPrefs(prev => ({ ...prev, weekly_forecast_day: isNaN(idx) ? prev.weekly_forecast_day : idx }));
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const { error } = await supabase.from('user_notification_preferences').upsert({
        user_id: user.id,
        notification_permission: prefs.notification_permission,
        notification_enabled: prefs.notification_enabled,
        daily_horoscope_enabled: prefs.daily_horoscope_enabled,
        weekly_forecast_enabled: prefs.weekly_forecast_enabled,
        transit_alerts_enabled: prefs.transit_alerts_enabled,
        chat_reminders_enabled: prefs.chat_reminders_enabled,
        subscription_reminders_enabled: prefs.subscription_reminders_enabled,
        promotional_enabled: prefs.promotional_enabled,
        daily_horoscope_time: prefs.daily_horoscope_time,
        weekly_forecast_day: prefs.weekly_forecast_day,
      });

      if (error) throw error;
      setSuccess('Notification preferences updated');
    } catch (e: any) {
      setError(e.message || 'Failed to save notification preferences');
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return <p style={{ color: '#ccc' }}>Sign in to manage notification preferences.</p>;
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ fontSize: 14, color: '#ccc' }}>
        Browser permission: <strong>{prefs.notification_permission || 'unknown'}</strong>{' '}
        {prefs.notification_permission === 'denied' && (
          <span style={{ color: '#f97373' }}>(enable notifications from browser settings)</span>
        )}
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="checkbox"
          checked={prefs.notification_enabled}
          onChange={() => handleToggle('notification_enabled')}
          disabled={loading}
        />
        <span>Enable web push notifications</span>
      </label>

      {prefs.notification_enabled && (
        <div style={{ borderTop: '1px solid #333', paddingTop: 8, display: 'grid', gap: 8, fontSize: 14 }}>
          <div style={{ fontWeight: 600 }}>Categories</div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={prefs.daily_horoscope_enabled}
              onChange={() => handleToggle('daily_horoscope_enabled')}
              disabled={loading}
            />
            <span>Daily horoscope</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={prefs.weekly_forecast_enabled}
              onChange={() => handleToggle('weekly_forecast_enabled')}
              disabled={loading}
            />
            <span>Weekly forecast</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={prefs.transit_alerts_enabled}
              onChange={() => handleToggle('transit_alerts_enabled')}
              disabled={loading}
            />
            <span>Transit alerts</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={prefs.chat_reminders_enabled}
              onChange={() => handleToggle('chat_reminders_enabled')}
              disabled={loading}
            />
            <span>Chat reminders</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={prefs.subscription_reminders_enabled}
              onChange={() => handleToggle('subscription_reminders_enabled')}
              disabled={loading}
            />
            <span>Subscription & billing reminders</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={prefs.promotional_enabled}
              onChange={() => handleToggle('promotional_enabled')}
              disabled={loading}
            />
            <span>Promotional offers</span>
          </label>

          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <div>
              <div style={{ marginBottom: 4 }}>Daily horoscope time</div>
              <input
                type="time"
                value={prefs.daily_horoscope_time.slice(0, 5)}
                onChange={e => handleTimeChange(`${e.target.value}:00`)}
                disabled={loading}
              />
            </div>
            <div>
              <div style={{ marginBottom: 4 }}>Weekly forecast day</div>
              <select
                value={prefs.weekly_forecast_day}
                onChange={e => handleDayChange(e.target.value)}
                disabled={loading}
              >
                {days.map((d, idx) => (
                  <option key={d} value={idx}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={loading || saving}
          style={{
            padding: '8px 16px',
            borderRadius: 999,
            border: 'none',
            cursor: loading || saving ? 'not-allowed' : 'pointer',
            background:
              'linear-gradient(135deg, #ed0687 0%, #ff7ac4 50%, #f97316 100%)',
            color: '#fff',
            fontWeight: 500,
            fontSize: 14,
          }}
        >
          {saving ? 'Saving...' : 'Save Preferences'}
        </button>
        {loading && <span style={{ fontSize: 13, color: '#aaa' }}>Loading...</span>}
        {error && <span style={{ fontSize: 13, color: '#f97373' }}>{error}</span>}
        {success && <span style={{ fontSize: 13, color: '#4ade80' }}>{success}</span>}
      </div>
    </div>
  );
};

export default NotificationPreferences;



