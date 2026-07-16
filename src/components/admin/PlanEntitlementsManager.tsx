// src/components/admin/PlanEntitlementsManager.tsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';

interface PlanEntitlement {
  plan_id: string;
  questions_per_month: number;
  ai_call_talk_minutes: number;
  daily_horoscope_enabled: boolean;
  divisional_charts_enabled: boolean;
  weekly_forecasts_enabled: boolean;
  max_profiles: number;
  max_saved_threads: number;
  updated_at: string;
}

export default function PlanEntitlementsManager() {
  const [plans, setPlans] = useState<PlanEntitlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [editedPlans, setEditedPlans] = useState<Record<string, Partial<PlanEntitlement>>>({});

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('plan_entitlements')
        .select('*')
        .order('plan_id');

      if (error) throw error;
      setPlans(data || []);

      // Initialize edited plans
      const initial: Record<string, Partial<PlanEntitlement>> = {};
      (data || []).forEach(plan => {
        initial[plan.plan_id] = { ...plan };
      });
      setEditedPlans(initial);
    } catch (error: any) {
      console.error('Error fetching plans:', error);
      setMessage({ type: 'error', text: `Failed to load plans: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (planId: string, field: keyof PlanEntitlement, value: any) => {
    setEditedPlans(prev => ({
      ...prev,
      [planId]: {
        ...prev[planId],
        [field]: value
      }
    }));
  };

  const handleSave = async (planId: string) => {
    setSaving(planId);
    setMessage(null);

    try {
      const updates = editedPlans[planId];

      const { error } = await supabase
        .from('plan_entitlements')
        .update({
          questions_per_month: updates.questions_per_month,
          ai_call_talk_minutes: updates.ai_call_talk_minutes,
          daily_horoscope_enabled: updates.daily_horoscope_enabled,
          divisional_charts_enabled: updates.divisional_charts_enabled,
          weekly_forecasts_enabled: updates.weekly_forecasts_enabled,
          max_profiles: updates.max_profiles,
          max_saved_threads: updates.max_saved_threads,
          updated_at: new Date().toISOString()
        })
        .eq('plan_id', planId);

      if (error) throw error;

      setMessage({ type: 'success', text: `✓ ${planId} plan updated successfully!` });

      // Refresh data
      await fetchPlans();
    } catch (error: any) {
      console.error('Error updating plan:', error);
      setMessage({ type: 'error', text: `Failed to update: ${error.message}` });
    } finally {
      setSaving(null);
    }
  };

  const hasChanges = (planId: string) => {
    const original = plans.find(p => p.plan_id === planId);
    const edited = editedPlans[planId];
    if (!original || !edited) return false;

    return (
      original.questions_per_month !== edited.questions_per_month ||
      original.ai_call_talk_minutes !== edited.ai_call_talk_minutes ||
      original.daily_horoscope_enabled !== edited.daily_horoscope_enabled ||
      original.divisional_charts_enabled !== edited.divisional_charts_enabled ||
      original.weekly_forecasts_enabled !== edited.weekly_forecasts_enabled ||
      original.max_profiles !== edited.max_profiles ||
      original.max_saved_threads !== edited.max_saved_threads
    );
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
        Loading plans...
      </div>
    );
  }

  const getPlanColor = (planId: string) => {
    switch (planId) {
      case 'free': return '#4a9eff';
      case 'monthly': return '#ffa94a';
      case 'yearly': return '#8b5cf6';
      default: return '#666';
    }
  };

  const getPlanIcon = (planId: string) => {
    switch (planId) {
      case 'free': return '🆓';
      case 'monthly': return '📅';
      case 'yearly': return '⭐';
      default: return '📦';
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ marginBottom: '30px' }}>
        <h2 style={{ margin: '0 0 8px 0', color: '#fff', fontSize: '24px' }}>
          Plan Entitlements Configuration
        </h2>
        <p style={{ margin: 0, color: '#999', fontSize: '14px' }}>
          Configure usage limits and features for each subscription plan
        </p>
      </div>

      {message && (
        <div style={{
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '20px',
          backgroundColor: message.type === 'success' ? '#1a3a1a' : '#3a1a1a',
          border: `1px solid ${message.type === 'success' ? '#2d5a2d' : '#5a2d2d'}`,
          color: message.type === 'success' ? '#6fd96f' : '#ff6b6b'
        }}>
          {message.text}
        </div>
      )}

      <div style={{ display: 'grid', gap: '24px' }}>
        {plans.map(plan => {
          const edited = editedPlans[plan.plan_id] || {};
          const color = getPlanColor(plan.plan_id);

          return (
            <div
              key={plan.plan_id}
              style={{
                backgroundColor: '#1f1f1f',
                borderRadius: '12px',
                padding: '24px',
                border: `2px solid ${color}30`,
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
              }}
            >
              {/* Header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '24px',
                paddingBottom: '16px',
                borderBottom: '1px solid #333'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '32px' }}>{getPlanIcon(plan.plan_id)}</span>
                  <div>
                    <h3 style={{
                      margin: 0,
                      color: color,
                      fontSize: '20px',
                      textTransform: 'capitalize',
                      fontWeight: 600
                    }}>
                      {plan.plan_id} Plan
                    </h3>
                    <p style={{ margin: '4px 0 0 0', color: '#888', fontSize: '12px' }}>
                      Last updated: {new Date(plan.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleSave(plan.plan_id)}
                  disabled={!hasChanges(plan.plan_id) || saving === plan.plan_id}
                  style={{
                    padding: '10px 24px',
                    backgroundColor: hasChanges(plan.plan_id) ? color : '#333',
                    color: hasChanges(plan.plan_id) ? '#fff' : '#666',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: hasChanges(plan.plan_id) ? 'pointer' : 'not-allowed',
                    fontSize: '14px',
                    fontWeight: 600,
                    transition: 'all 0.2s',
                    opacity: saving === plan.plan_id ? 0.6 : 1
                  }}
                >
                  {saving === plan.plan_id ? 'Saving...' : hasChanges(plan.plan_id) ? 'Save Changes' : 'No Changes'}
                </button>
              </div>

              {/* Usage Limits */}
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{ margin: '0 0 16px 0', color: '#ccc', fontSize: '16px' }}>
                  📊 Usage Limits
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{
                      display: 'block',
                      marginBottom: '8px',
                      color: '#aaa',
                      fontSize: '13px',
                      fontWeight: 500
                    }}>
                      Questions per Month
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={edited.questions_per_month ?? 0}
                      onChange={(e) => handleFieldChange(plan.plan_id, 'questions_per_month', parseInt(e.target.value))}
                      style={{
                        width: '100%',
                        padding: '12px',
                        backgroundColor: '#2a2a2a',
                        border: '1px solid #444',
                        borderRadius: '6px',
                        color: '#fff',
                        fontSize: '16px'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{
                      display: 'block',
                      marginBottom: '8px',
                      color: '#aaa',
                      fontSize: '13px',
                      fontWeight: 500
                    }}>
                      AI Call Minutes per Month
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={edited.ai_call_talk_minutes ?? 0}
                      onChange={(e) => handleFieldChange(plan.plan_id, 'ai_call_talk_minutes', parseInt(e.target.value))}
                      style={{
                        width: '100%',
                        padding: '12px',
                        backgroundColor: '#2a2a2a',
                        border: '1px solid #444',
                        borderRadius: '6px',
                        color: '#fff',
                        fontSize: '16px'
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Profile & Thread Limits */}
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{ margin: '0 0 16px 0', color: '#ccc', fontSize: '16px' }}>
                  👤 Profile & Thread Limits
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{
                      display: 'block',
                      marginBottom: '8px',
                      color: '#aaa',
                      fontSize: '13px',
                      fontWeight: 500
                    }}>
                      Max Profiles
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={edited.max_profiles ?? 1}
                      onChange={(e) => handleFieldChange(plan.plan_id, 'max_profiles', parseInt(e.target.value))}
                      style={{
                        width: '100%',
                        padding: '12px',
                        backgroundColor: '#2a2a2a',
                        border: '1px solid #444',
                        borderRadius: '6px',
                        color: '#fff',
                        fontSize: '16px'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{
                      display: 'block',
                      marginBottom: '8px',
                      color: '#aaa',
                      fontSize: '13px',
                      fontWeight: 500
                    }}>
                      Max Saved Threads
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={edited.max_saved_threads ?? 3}
                      onChange={(e) => handleFieldChange(plan.plan_id, 'max_saved_threads', parseInt(e.target.value))}
                      style={{
                        width: '100%',
                        padding: '12px',
                        backgroundColor: '#2a2a2a',
                        border: '1px solid #444',
                        borderRadius: '6px',
                        color: '#fff',
                        fontSize: '16px'
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Feature Toggles */}
              <div>
                <h4 style={{ margin: '0 0 16px 0', color: '#ccc', fontSize: '16px' }}>
                  ✨ Features
                </h4>
                <div style={{ display: 'grid', gap: '12px' }}>
                  {[
                    { key: 'daily_horoscope_enabled', label: 'Daily Horoscope', icon: '🌟' },
                    { key: 'divisional_charts_enabled', label: 'Divisional Charts', icon: '📊' },
                    { key: 'weekly_forecasts_enabled', label: 'Weekly Forecasts', icon: '📅' }
                  ].map(feature => (
                    <label
                      key={feature.key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '12px',
                        backgroundColor: '#2a2a2a',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#333'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2a2a2a'}
                    >
                      <input
                        type="checkbox"
                        checked={edited[feature.key as keyof PlanEntitlement] as boolean ?? false}
                        onChange={(e) => handleFieldChange(plan.plan_id, feature.key as keyof PlanEntitlement, e.target.checked)}
                        style={{
                          width: '20px',
                          height: '20px',
                          cursor: 'pointer',
                          accentColor: color
                        }}
                      />
                      <span style={{ fontSize: '18px' }}>{feature.icon}</span>
                      <span style={{ color: '#fff', fontSize: '14px' }}>{feature.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
