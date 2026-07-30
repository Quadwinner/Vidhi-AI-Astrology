import React, { useState, useEffect, useCallback } from 'react';
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

const PLAN_META: Record<string, { label: string; cycle: string; hint: string }> = {
  free: {
    label: 'Seeker — Free',
    cycle: 'Calendar month',
    hint: 'Included chats & calls before wallet pay-per-use kicks in.',
  },
  monthly: {
    label: 'Ascendant — Monthly',
    cycle: 'Calendar month',
    hint: 'Resets on the 1st of each month. After the allowance, wallet is charged.',
  },
  yearly: {
    label: 'Celestial — Yearly',
    cycle: 'Annual billing cycle',
    hint: 'Resets on subscription anniversary. Limits apply for the full year.',
  },
};

function parseNum(value: string): number {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export default function PlanEntitlementsManager() {
  const [plans, setPlans] = useState<PlanEntitlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [editedPlans, setEditedPlans] = useState<Record<string, Partial<PlanEntitlement>>>({});

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('plan_entitlements')
        .select('*')
        .order('plan_id');

      if (error) throw error;
      setPlans(data || []);

      const initial: Record<string, Partial<PlanEntitlement>> = {};
      (data || []).forEach((plan) => {
        initial[plan.plan_id] = { ...plan };
      });
      setEditedPlans(initial);
    } catch (error: any) {
      setMessage({ type: 'error', text: `Failed to load plans: ${error.message}` });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const handleFieldChange = (planId: string, field: keyof PlanEntitlement, value: number | boolean) => {
    setEditedPlans((prev) => ({
      ...prev,
      [planId]: { ...prev[planId], [field]: value },
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
          updated_at: new Date().toISOString(),
        })
        .eq('plan_id', planId);

      if (error) throw error;
      setMessage({ type: 'success', text: `${PLAN_META[planId]?.label || planId} saved. New limits apply immediately.` });
      await fetchPlans();
    } catch (error: any) {
      setMessage({ type: 'error', text: `Failed to update: ${error.message}` });
    } finally {
      setSaving(null);
    }
  };

  const hasChanges = (planId: string) => {
    const original = plans.find((p) => p.plan_id === planId);
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

  const questionLabel = (planId: string) =>
    planId === 'yearly' ? 'Chat questions (per year)' : 'Chat questions (per month)';

  const callLabel = (planId: string) =>
    planId === 'yearly' ? 'AI call minutes (per year)' : 'AI call minutes (per month)';

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>Loading plan allowances…</div>;
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: '0 0 8px', color: '#fff', fontSize: 24 }}>Plan allowances — chat & calls</h2>
        <p style={{ margin: 0, color: '#999', fontSize: 14, maxWidth: 720, lineHeight: 1.6 }}>
          Set how many chat messages and AI call minutes each membership tier includes before wallet billing.
          Members see these limits on the Manage Membership page.
        </p>
      </div>

      {message && (
        <div
          style={{
            padding: 16,
            borderRadius: 8,
            marginBottom: 20,
            backgroundColor: message.type === 'success' ? '#1a3a1a' : '#3a1a1a',
            border: `1px solid ${message.type === 'success' ? '#2d5a2d' : '#5a2d2d'}`,
            color: message.type === 'success' ? '#6fd96f' : '#ff6b6b',
          }}
        >
          {message.text}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12,
          marginBottom: 28,
          padding: 16,
          background: '#161616',
          borderRadius: 10,
          border: '1px solid #2a2a2a',
        }}
      >
        {plans.map((plan) => {
          const edited = editedPlans[plan.plan_id] || plan;
          const meta = PLAN_META[plan.plan_id];
          return (
            <div key={plan.plan_id} style={{ textAlign: 'center' }}>
              <div style={{ color: '#888', fontSize: 12, marginBottom: 4 }}>{meta?.label || plan.plan_id}</div>
              <div style={{ color: '#fff', fontSize: 18, fontWeight: 600 }}>
                {edited.questions_per_month ?? 0} chats
              </div>
              <div style={{ color: '#c9a227', fontSize: 14 }}>
                {edited.ai_call_talk_minutes ?? 0} call min
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'grid', gap: 24 }}>
        {plans.map((plan) => {
          const edited = editedPlans[plan.plan_id] || {};
          const meta = PLAN_META[plan.plan_id];
          const color = plan.plan_id === 'yearly' ? '#c9a227' : plan.plan_id === 'monthly' ? '#ffa94a' : '#4a9eff';

          return (
            <div
              key={plan.plan_id}
              style={{
                backgroundColor: '#1f1f1f',
                borderRadius: 12,
                padding: 24,
                border: `1px solid ${color}40`,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 16,
                  marginBottom: 20,
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <h3 style={{ margin: 0, color, fontSize: 20, fontWeight: 600 }}>
                    {meta?.label || plan.plan_id}
                  </h3>
                  <p style={{ margin: '6px 0 0', color: '#888', fontSize: 13 }}>
                    Billing cycle: <strong style={{ color: '#ccc' }}>{meta?.cycle || '—'}</strong>
                  </p>
                  <p style={{ margin: '4px 0 0', color: '#666', fontSize: 12 }}>{meta?.hint}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleSave(plan.plan_id)}
                  disabled={!hasChanges(plan.plan_id) || saving === plan.plan_id}
                  style={{
                    padding: '10px 24px',
                    backgroundColor: hasChanges(plan.plan_id) ? color : '#333',
                    color: hasChanges(plan.plan_id) ? '#111' : '#666',
                    border: 'none',
                    borderRadius: 8,
                    cursor: hasChanges(plan.plan_id) ? 'pointer' : 'not-allowed',
                    fontSize: 14,
                    fontWeight: 600,
                    opacity: saving === plan.plan_id ? 0.6 : 1,
                  }}
                >
                  {saving === plan.plan_id ? 'Saving…' : hasChanges(plan.plan_id) ? 'Save' : 'Saved'}
                </button>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 16,
                  marginBottom: 20,
                  padding: 16,
                  background: '#161616',
                  borderRadius: 8,
                }}
              >
                <div>
                  <label style={{ display: 'block', marginBottom: 8, color: '#ccc', fontSize: 13, fontWeight: 600 }}>
                    {questionLabel(plan.plan_id)}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={edited.questions_per_month ?? 0}
                    onChange={(e) =>
                      handleFieldChange(plan.plan_id, 'questions_per_month', parseNum(e.target.value))
                    }
                    style={inputStyle}
                  />
                  <span style={hintStyle}>Included chat messages per member</span>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: 8, color: '#ccc', fontSize: 13, fontWeight: 600 }}>
                    {callLabel(plan.plan_id)}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={edited.ai_call_talk_minutes ?? 0}
                    onChange={(e) =>
                      handleFieldChange(plan.plan_id, 'ai_call_talk_minutes', parseNum(e.target.value))
                    }
                    style={inputStyle}
                  />
                  <span style={hintStyle}>Included voice-call minutes per member</span>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: 8, color: '#ccc', fontSize: 13, fontWeight: 600 }}>
                    Max profiles
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={edited.max_profiles ?? 1}
                    onChange={(e) => handleFieldChange(plan.plan_id, 'max_profiles', Math.max(1, parseNum(e.target.value)))}
                    style={inputStyle}
                  />
                </div>
              </div>

              <details style={{ color: '#888', fontSize: 13 }}>
                <summary style={{ cursor: 'pointer', color: '#aaa', marginBottom: 12 }}>Feature toggles</summary>
                <div style={{ display: 'grid', gap: 8 }}>
                  {[
                    { key: 'daily_horoscope_enabled' as const, label: 'Daily horoscope' },
                    { key: 'divisional_charts_enabled' as const, label: 'Divisional charts' },
                    { key: 'weekly_forecasts_enabled' as const, label: 'Weekly forecasts' },
                  ].map((feature) => (
                    <label key={feature.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input
                        type="checkbox"
                        checked={(edited[feature.key] as boolean) ?? false}
                        onChange={(e) => handleFieldChange(plan.plan_id, feature.key, e.target.checked)}
                      />
                      {feature.label}
                    </label>
                  ))}
                </div>
              </details>
            </div>
          );
        })}
      </div>

      <p style={{ marginTop: 24, color: '#666', fontSize: 12, lineHeight: 1.5 }}>
        Pay-per-use wallet rates (₹ per chat / per call minute after allowance) are configured under{' '}
        <strong style={{ color: '#888' }}>Price &amp; Settings → Usage Pricing</strong>.
      </p>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: 12,
  backgroundColor: '#2a2a2a',
  border: '1px solid #444',
  borderRadius: 6,
  color: '#fff',
  fontSize: 16,
  boxSizing: 'border-box',
};

const hintStyle: React.CSSProperties = {
  display: 'block',
  marginTop: 6,
  color: '#666',
  fontSize: 11,
};
